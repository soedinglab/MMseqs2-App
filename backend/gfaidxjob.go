package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
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
	Registry       string `json:"registry" validate:"required"`
	TimeoutSeconds int    `json:"timeoutseconds" validate:"omitempty,gte=1"`
	MaxThreads     int    `json:"maxthreads" validate:"omitempty,gte=1"`
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
	Threads    int    `json:"threads"`
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
	Threads       int     `json:"threads"`
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
	Threads       int           `json:"threads" validate:"required,gte=1"`
	Reference     string        `json:"reference,omitempty"`
	AllHaplotypes bool          `json:"all_haplotypes,omitempty"`
	HaplotypeGap  string        `json:"haplotype_gap,omitempty"`
	NoPaths       bool          `json:"no_paths,omitempty"`
	WithCoords    bool          `json:"with_coords,omitempty"`
}

// GfaidxCacheVersion can be incremented if result semantics change without a
// corresponding change in the public request fields.
const GfaidxCacheVersion = "v1"

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

// effectiveGfaidxThreads applies the safe default and configured server limit.
func effectiveGfaidxThreads(requested int, config ConfigGfaidx) (int, error) {
	if requested == 0 {
		requested = 1
	}
	if requested < 1 {
		return 0, errors.New("threads must be at least 1")
	}
	if config.MaxThreads > 0 && requested > config.MaxThreads {
		return 0, fmt.Errorf("threads must not exceed %d", config.MaxThreads)
	}
	return requested, nil
}

// loadGfaidxGraphRegistry reads the server-controlled TSV registry. Relative
// graph paths are interpreted relative to the registry file, matching the
// graphviz_wasm prototype's behavior.
func loadGfaidxGraphRegistry(config ConfigGfaidx) (map[string]GfaidxGraph, error) {
	file, err := os.Open(config.Registry)
	if err != nil {
		return nil, fmt.Errorf("open gfaidx graph registry: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.Comma = '\t'
	reader.FieldsPerRecord = -1
	reader.TrimLeadingSpace = true

	header, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("read gfaidx graph registry header: %w", err)
	}
	columns := make(map[string]int, len(header))
	for index, name := range header {
		columns[strings.TrimSpace(name)] = index
	}
	for _, required := range []string{"graph_id", "display_name", "path"} {
		if _, ok := columns[required]; !ok {
			return nil, fmt.Errorf("gfaidx graph registry is missing %q column", required)
		}
	}

	registryDir := filepath.Dir(config.Registry)
	graphs := make(map[string]GfaidxGraph)
	for line := 2; ; line++ {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("read gfaidx graph registry line %d: %w", line, err)
		}
		if len(record) == 0 || (len(record) == 1 && strings.TrimSpace(record[0]) == "") {
			continue
		}

		// value returns an empty string for an absent optional column or field.
		value := func(name string) string {
			index, ok := columns[name]
			if !ok || index >= len(record) {
				return ""
			}
			return strings.TrimSpace(record[index])
		}

		id := value("graph_id")
		displayName := value("display_name")
		rawPath := value("path")
		if id == "" || displayName == "" || rawPath == "" {
			return nil, fmt.Errorf("gfaidx graph registry line %d is incomplete", line)
		}
		if !validGfaidxGraphID.MatchString(id) {
			return nil, fmt.Errorf("gfaidx graph registry line %d has invalid graph ID", line)
		}
		if _, exists := graphs[id]; exists {
			return nil, fmt.Errorf("gfaidx graph registry contains duplicate graph ID %q", id)
		}

		graphPath := rawPath
		if !filepath.IsAbs(graphPath) {
			graphPath = filepath.Join(registryDir, graphPath)
		}
		graphPath, err = filepath.Abs(graphPath)
		if err != nil {
			return nil, fmt.Errorf("resolve gfaidx graph %q: %w", id, err)
		}

		graph := GfaidxGraph{
			ID:          id,
			DisplayName: displayName,
			Path:        filepath.Clean(graphPath),
			Description: value("description"),
			Version:     value("version"),
		}
		if graph.Version == "" {
			graph.Version, err = deriveGfaidxGraphVersion(graph.Path)
			if err != nil {
				return nil, fmt.Errorf("inspect gfaidx graph %q: %w", id, err)
			}
		} else if _, err := os.Stat(graph.Path); err != nil {
			return nil, fmt.Errorf("inspect gfaidx graph %q: %w", id, err)
		}
		graphs[id] = graph
	}

	if len(graphs) == 0 {
		return nil, errors.New("gfaidx graph registry contains no graphs")
	}
	return graphs, nil
}

// deriveGfaidxGraphVersion fingerprints the indexed graph and known sidecars
// when the registry does not provide an explicit deployment version.
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
// registry entry and rejects unknown graph selections.
func resolveGfaidxGraph(graphID string, config ConfigGfaidx) (GfaidxGraph, error) {
	graphID = strings.TrimSpace(graphID)
	if !validGfaidxGraphID.MatchString(graphID) {
		return GfaidxGraph{}, errors.New("invalid graph ID")
	}
	graphs, err := loadGfaidxGraphRegistry(config)
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
	return value, nil
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
	if input.MaxNodes < 1 {
		return JobRequest{}, errors.New("max_nodes must be at least 1")
	}
	threads, err := effectiveGfaidxThreads(input.Threads, config)
	if err != nil {
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
		Threads:      threads,
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
	threads, err := effectiveGfaidxThreads(input.Threads, config)
	if err != nil {
		return JobRequest{}, err
	}
	if err := validateGfaidxFlags(input.NoPaths, input.WithCoords); err != nil {
		return JobRequest{}, err
	}
	if input.HaplotypeGap != "" && !input.AllHaplotypes {
		return JobRequest{}, errors.New("haplotype_gap requires all_haplotypes")
	}
	if input.HaplotypeGap != "" && !validHaplotypeGap.MatchString(input.HaplotypeGap) {
		return JobRequest{}, errors.New("invalid haplotype_gap")
	}

	maxNodes := uint64(0)
	if !input.AllHaplotypes {
		if input.MaxNodes == nil || *input.MaxNodes < 1 {
			return JobRequest{}, errors.New("max_nodes must be at least 1 for BFS region extraction")
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
		Threads:       threads,
		Reference:     reference,
		AllHaplotypes: input.AllHaplotypes,
		HaplotypeGap:  input.HaplotypeGap,
		NoPaths:       input.NoPaths,
		WithCoords:    input.WithCoords,
	}
	return JobRequest{Id: job.Hash(), Status: StatusPending, Type: JobGfaidx, Job: job}, nil
}
