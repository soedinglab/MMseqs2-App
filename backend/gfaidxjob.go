package main

import (
	"bufio"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

// ConfigGfaidx enables the optional gfaidx API and points it at server-owned
// binaries and graph metadata. Browser requests never contain these paths.
type ConfigGfaidx struct {
	Binary         string `json:"binary" validate:"required"`
	Databases      string `json:"databases" validate:"required"`
	TimeoutSeconds int    `json:"timeoutseconds" validate:"omitempty,gte=1"`
	// Threads is controlled by the server and applies to every gfaidx query.
	Threads int `json:"threads" validate:"omitempty,gte=1"`
	// MaxOutputMB is a hard cap on every result file; gfaidx is stopped once it is exceeded.
	MaxOutputMB int `json:"maxoutputmb" validate:"omitempty,gte=1"`
	// DisplayLimitMB is the largest result served without ?download=true, i.e. to the frontend.
	DisplayLimitMB int `json:"displaylimitmb" validate:"omitempty,gte=1"`
}

// Defaults used when the server configuration omits the matching setting.
const (
	gfaidxDefaultMaxOutputMB    = 1024
	gfaidxDefaultDisplayLimitMB = 200
	// gfaidxDefaultHaplotypeGap bounds haplotype runs in repeat-rich regions of all-haplotype queries.
	gfaidxDefaultHaplotypeGap = "10kb"
	// gfaidxMaxHaplotypeGapBases (1mb) caps client-chosen gaps; larger ones are for local gfaidx runs.
	gfaidxMaxHaplotypeGapBases = 1_000_000
)

// validateGfaidxHaplotypeGap checks the gap format and size, using gfaidx's
// decimal units (1kb = 1,000 bases).
func validateGfaidxHaplotypeGap(gap string) error {
	match := validHaplotypeGap.FindStringSubmatch(gap)
	if match == nil {
		return errors.New("invalid haplotype_gap")
	}
	multiplier := map[string]uint64{"": 1, "bp": 1, "kb": 1_000, "mb": 1_000_000, "gb": 1_000_000_000}[strings.ToLower(match[2])]
	// Comparing against max/multiplier avoids overflow for very large values.
	bases, err := strconv.ParseUint(match[1], 10, 64)
	if err != nil || bases > gfaidxMaxHaplotypeGapBases/multiplier {
		return errors.New("haplotype_gap must be at most 1mb")
	}
	return nil
}

// gfaidxLimitBytes converts a configured megabyte limit to bytes, falling back
// to the default when the setting is omitted or not positive.
func gfaidxLimitBytes(configuredMB, defaultMB int) int64 {
	if configuredMB <= 0 {
		configuredMB = defaultMB
	}
	return int64(configuredMB) * 1024 * 1024
}

// GfaidxParams is the server-owned metadata stored in one <graph-id>.params
// file. Path must be relative to the configured gfaidx database directory.
type GfaidxParams struct {
	Name        string `json:"name" validate:"required"`
	Description string `json:"description,omitempty"`
	Version     string `json:"version,omitempty"`
	Path        string `json:"path" validate:"required"`
}

// GfaidxGraph is one read-only indexed graph exposed through its public ID.
// Path remains server-side and is deliberately omitted from API responses.
type GfaidxGraph struct {
	ID          string
	DisplayName string
	Path        string
	Description string
	Version     string
}

// GfaidxSubgraphRequest is the public request accepted for get_subgraph jobs.
type GfaidxSubgraphRequest struct {
	GraphID    string `json:"graph_id"`
	StartNode  string `json:"start_node"`
	MaxNodes   uint64 `json:"max_nodes"`
	NoPaths    bool   `json:"no_paths"`
	WithCoords bool   `json:"with_coords"`
}

// GfaidxRegionRequest is the public request accepted for get_region jobs.
// MaxNodes is a pointer so omission can be distinguished from an explicit 0.
type GfaidxRegionRequest struct {
	GraphID       string  `json:"graph_id"`
	Sequence      string  `json:"sequence"`
	Start         uint64  `json:"start"`
	End           uint64  `json:"end"`
	MaxNodes      *uint64 `json:"max_nodes,omitempty"`
	Reference     string  `json:"reference"`
	AllHaplotypes bool    `json:"all_haplotypes"`
	HaplotypeGap  string  `json:"haplotype_gap"`
	NoPaths       bool    `json:"no_paths"`
	WithCoords    bool    `json:"with_coords"`
}

// GfaidxCommand identifies the only two gfaidx subcommands accepted by the
// worker. It is stored in job.json so queued and remote workers can dispatch it.
type GfaidxCommand string

const (
	GfaidxGetSubgraph GfaidxCommand = "get_subgraph"
	GfaidxGetRegion   GfaidxCommand = "get_region"
)

// GfaidxJob is the normalized, queue-safe representation of either supported
// request. It stores a graph ID and version, never a client-provided path.
type GfaidxJob struct {
	Command       GfaidxCommand `json:"command" validate:"required,oneof=get_subgraph get_region"`
	GraphID       string        `json:"graph_id" validate:"required"`
	GraphVersion  string        `json:"graph_version" validate:"required"`
	StartNode     string        `json:"start_node,omitempty"`
	Sequence      string        `json:"sequence,omitempty"`
	Start         uint64        `json:"start,omitempty"`
	End           uint64        `json:"end,omitempty"`
	MaxNodes      uint64        `json:"max_nodes,omitempty"`
	Reference     string        `json:"reference,omitempty"`
	AllHaplotypes bool          `json:"all_haplotypes,omitempty"`
	HaplotypeGap  string        `json:"haplotype_gap,omitempty"`
	NoPaths       bool          `json:"no_paths,omitempty"`
	WithCoords    bool          `json:"with_coords,omitempty"`
}

// GfaidxCacheVersion can be incremented if result semantics change without a
// corresponding change in the public request fields.
// v2: gfaidx 2.1.0 with an explicit --mode and a default haplotype_gap.
const GfaidxCacheVersion = "v2"

// Hash makes identical queries reuse the existing MMseqs job cache and ticket
// behavior. The graph version prevents results surviving a graph replacement.
func (r GfaidxJob) Hash() Id {
	h := sha256.New224()
	h.Write([]byte(GfaidxCacheVersion))
	h.Write([]byte(JobGfaidx))
	serialized, _ := json.Marshal(r)
	h.Write(serialized)
	return Id(base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(h.Sum(nil)))
}

// Rank supplies a simple work estimate to the existing priority queue.
func (r GfaidxJob) Rank() float64 {
	if r.AllHaplotypes {
		return 1_000_000_000
	}
	return float64(r.MaxNodes)
}

// configuredGfaidxThreads returns the server-selected thread count. Zero keeps
// configurations that omit the setting safe by running each query single-threaded.
func configuredGfaidxThreads(config ConfigGfaidx) int {
	if config.Threads == 0 {
		return 1
	}
	return config.Threads
}

// loadGfaidxDatabases discovers graphs through <graph-id>.params files, like
// the existing MMseqs database convention, without using its mutable metadata.
func loadGfaidxDatabases(config ConfigGfaidx) (map[string]GfaidxGraph, error) {
	databaseDir, err := filepath.Abs(filepath.Clean(config.Databases))
	if err != nil {
		return nil, errors.New("resolve gfaidx database directory")
	}
	matches, err := filepath.Glob(filepath.Join(databaseDir, "*.params"))
	if err != nil {
		return nil, errors.New("scan gfaidx database directory")
	}

	graphs := make(map[string]GfaidxGraph, len(matches))
	for _, paramsPath := range matches {
		paramsName := filepath.Base(paramsPath)
		id := strings.TrimSuffix(paramsName, filepath.Ext(paramsName))
		if !validGfaidxGraphID.MatchString(id) {
			return nil, fmt.Errorf("gfaidx params %q has an invalid graph ID", paramsName)
		}

		file, err := os.Open(paramsPath)
		if err != nil {
			return nil, fmt.Errorf("open gfaidx params %q", paramsName)
		}
		var params GfaidxParams
		decodeErr := DecodeJsonAndValidate(bufio.NewReader(file), &params)
		closeErr := file.Close()
		if decodeErr != nil {
			return nil, fmt.Errorf("read gfaidx params %q: %w", paramsName, decodeErr)
		}
		if closeErr != nil {
			return nil, fmt.Errorf("close gfaidx params %q", paramsName)
		}

		rawPath := strings.TrimSpace(params.Path)
		if filepath.IsAbs(rawPath) {
			return nil, fmt.Errorf("gfaidx params %q must use a relative graph path", paramsName)
		}
		graphPath := filepath.Clean(filepath.Join(databaseDir, rawPath))
		relativePath, err := filepath.Rel(databaseDir, graphPath)
		if err != nil || relativePath == ".." || strings.HasPrefix(relativePath, ".."+string(filepath.Separator)) {
			return nil, fmt.Errorf("gfaidx params %q points outside the database directory", paramsName)
		}

		graph := GfaidxGraph{
			ID:          id,
			DisplayName: strings.TrimSpace(params.Name),
			Path:        graphPath,
			Description: strings.TrimSpace(params.Description),
			Version:     strings.TrimSpace(params.Version),
		}
		if graph.DisplayName == "" {
			return nil, fmt.Errorf("gfaidx params %q has an empty graph name", paramsName)
		}
		if info, statErr := os.Stat(graph.Path); statErr != nil || !info.Mode().IsRegular() {
			return nil, fmt.Errorf("inspect gfaidx graph %q: indexed graph was not found", id)
		}
		if graph.Version == "" {
			graph.Version, err = deriveGfaidxGraphVersion(graph.Path)
			if err != nil {
				return nil, fmt.Errorf("inspect gfaidx graph %q: indexed graph or sidecar could not be read", id)
			}
		}
		graphs[id] = graph
	}

	if len(graphs) == 0 {
		return nil, errors.New("gfaidx database directory contains no .params files")
	}
	return graphs, nil
}

// deriveGfaidxGraphVersion fingerprints the indexed graph and known sidecars
// when the params file does not provide an explicit deployment version.
func deriveGfaidxGraphVersion(graphPath string) (string, error) {
	h := sha256.New()
	found := false
	for _, suffix := range []string{"", ".idx", ".ndx", ".pdx", ".lnx", ".pcx", ".cdx"} {
		path := graphPath + suffix
		info, err := os.Stat(path)
		if errors.Is(err, os.ErrNotExist) && suffix != "" {
			continue
		}
		if err != nil {
			return "", err
		}
		found = true
		h.Write([]byte(suffix))
		h.Write([]byte(strconv.FormatInt(info.Size(), 10)))
		h.Write([]byte(strconv.FormatInt(info.ModTime().UnixNano(), 10)))
	}
	if !found {
		return "", errors.New("indexed graph was not found")
	}
	return base64.RawURLEncoding.EncodeToString(h.Sum(nil)[:12]), nil
}

// resolveGfaidxGraph converts a public graph ID into its server-controlled
// database entry and rejects unknown graph selections.
func resolveGfaidxGraph(graphID string, config ConfigGfaidx) (GfaidxGraph, error) {
	graphID = strings.TrimSpace(graphID)
	if !validGfaidxGraphID.MatchString(graphID) {
		return GfaidxGraph{}, errors.New("invalid graph ID")
	}
	graphs, err := loadGfaidxDatabases(config)
	if err != nil {
		return GfaidxGraph{}, err
	}
	graph, ok := graphs[graphID]
	if !ok {
		return GfaidxGraph{}, errors.New("unknown graph selection")
	}
	return graph, nil
}

var validGfaidxGraphID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$`)
var validHaplotypeGap = regexp.MustCompile(`^(0|[1-9][0-9]*)([bB][pP]|[kKmMgG][bB])?$`)

// validateGfaidxText rejects empty, excessively long, or control-character
// values before they are stored in a job or passed as one process argument.
func validateGfaidxText(name, value string, required bool) (string, error) {
	value = strings.TrimSpace(value)
	if required && value == "" {
		return "", fmt.Errorf("%s is required", name)
	}
	if len(value) > 4096 {
		return "", fmt.Errorf("%s is too long", name)
	}
	if strings.IndexFunc(value, unicode.IsControl) >= 0 {
		return "", fmt.Errorf("%s contains a control character", name)
	}
	// gfaidx would parse a leading "-" as a command-line option (e.g. "--idx=/path").
	if strings.HasPrefix(value, "-") {
		return "", fmt.Errorf("%s cannot start with '-'", name)
	}
	return value, nil
}

// gfaidxMaxNodes bounds BFS size; gfaidx reserves memory in proportion to max_nodes up front.
const gfaidxMaxNodes = 1_000_000

// validateGfaidxMaxNodes checks a client-chosen BFS node budget.
func validateGfaidxMaxNodes(maxNodes uint64) error {
	if maxNodes < 1 || maxNodes > gfaidxMaxNodes {
		return fmt.Errorf("max_nodes must be between 1 and %d", gfaidxMaxNodes)
	}
	return nil
}

// validateGfaidxFlags enforces combinations that gfaidx itself cannot use.
func validateGfaidxFlags(noPaths, withCoords bool) error {
	if noPaths && withCoords {
		return errors.New("with_coords cannot be combined with no_paths")
	}
	return nil
}

// NewGfaidxSubgraphJobRequest validates and normalizes a public get_subgraph
// request before handing it to the shared ticket queue.
func NewGfaidxSubgraphJobRequest(input GfaidxSubgraphRequest, config ConfigGfaidx) (JobRequest, error) {
	graph, err := resolveGfaidxGraph(input.GraphID, config)
	if err != nil {
		return JobRequest{}, err
	}
	startNode, err := validateGfaidxText("start_node", input.StartNode, true)
	if err != nil {
		return JobRequest{}, err
	}
	if err := validateGfaidxMaxNodes(input.MaxNodes); err != nil {
		return JobRequest{}, err
	}
	if err := validateGfaidxFlags(input.NoPaths, input.WithCoords); err != nil {
		return JobRequest{}, err
	}

	job := GfaidxJob{
		Command:      GfaidxGetSubgraph,
		GraphID:      graph.ID,
		GraphVersion: graph.Version,
		StartNode:    startNode,
		MaxNodes:     input.MaxNodes,
		NoPaths:      input.NoPaths,
		WithCoords:   input.WithCoords,
	}
	return JobRequest{Id: job.Hash(), Status: StatusPending, Type: JobGfaidx, Job: job}, nil
}

// NewGfaidxRegionJobRequest validates and normalizes a public get_region
// request before handing it to the shared ticket queue.
func NewGfaidxRegionJobRequest(input GfaidxRegionRequest, config ConfigGfaidx) (JobRequest, error) {
	graph, err := resolveGfaidxGraph(input.GraphID, config)
	if err != nil {
		return JobRequest{}, err
	}
	sequence, err := validateGfaidxText("sequence", input.Sequence, true)
	if err != nil {
		return JobRequest{}, err
	}
	if strings.Contains(sequence, ":") {
		return JobRequest{}, errors.New("sequence cannot contain a colon")
	}
	if input.End <= input.Start {
		return JobRequest{}, errors.New("end must be greater than start")
	}
	reference, err := validateGfaidxText("reference", input.Reference, false)
	if err != nil {
		return JobRequest{}, err
	}
	if err := validateGfaidxFlags(input.NoPaths, input.WithCoords); err != nil {
		return JobRequest{}, err
	}
	if input.HaplotypeGap != "" && !input.AllHaplotypes {
		return JobRequest{}, errors.New("haplotype_gap requires all_haplotypes")
	}
	if input.HaplotypeGap != "" {
		if err := validateGfaidxHaplotypeGap(input.HaplotypeGap); err != nil {
			return JobRequest{}, err
		}
	}

	haplotypeGap := input.HaplotypeGap
	if input.AllHaplotypes && haplotypeGap == "" {
		// Clients can still pass their own gap, up to gfaidxMaxHaplotypeGapBases.
		haplotypeGap = gfaidxDefaultHaplotypeGap
	}

	maxNodes := uint64(0)
	if !input.AllHaplotypes {
		if input.MaxNodes == nil {
			return JobRequest{}, errors.New("max_nodes is required for BFS region extraction")
		}
		if err := validateGfaidxMaxNodes(*input.MaxNodes); err != nil {
			return JobRequest{}, err
		}
		maxNodes = *input.MaxNodes
	}

	job := GfaidxJob{
		Command:       GfaidxGetRegion,
		GraphID:       graph.ID,
		GraphVersion:  graph.Version,
		Sequence:      sequence,
		Start:         input.Start,
		End:           input.End,
		MaxNodes:      maxNodes,
		Reference:     reference,
		AllHaplotypes: input.AllHaplotypes,
		HaplotypeGap:  haplotypeGap,
		NoPaths:       input.NoPaths,
		WithCoords:    input.WithCoords,
	}
	return JobRequest{Id: job.Hash(), Status: StatusPending, Type: JobGfaidx, Job: job}, nil
}
