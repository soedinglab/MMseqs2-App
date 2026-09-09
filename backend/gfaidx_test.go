package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"testing"

	"github.com/gorilla/mux"
)

// newTestGfaidxConfig creates a complete server-controlled graph database
// without depending on the developer's ignored integration-test data.
func newTestGfaidxConfig(t *testing.T) (ConfigGfaidx, string) {
	t.Helper()
	databaseDir := t.TempDir()
	graphPath := filepath.Join(databaseDir, "example.gfa.gz")
	if err := os.WriteFile(graphPath, []byte("indexed graph"), 0644); err != nil {
		t.Fatal(err)
	}
	params := `{"name":"Example graph","description":"Test graph","version":"v1","path":"example.gfa.gz"}`
	if err := os.WriteFile(filepath.Join(databaseDir, "example.params"), []byte(params), 0644); err != nil {
		t.Fatal(err)
	}
	return ConfigGfaidx{
		Binary:         "/server/bin/gfaidx",
		Databases:      databaseDir,
		TimeoutSeconds: 30,
		MaxThreads:     4,
	}, graphPath
}

// TestGfaidxDatabaseDiscoveryRequiresParams ensures unregistered graph files
// are not exposed merely because they exist in the mounted directory.
func TestGfaidxDatabaseDiscoveryRequiresParams(t *testing.T) {
	databaseDir := t.TempDir()
	if err := os.WriteFile(filepath.Join(databaseDir, "orphan.gfa.gz"), []byte("graph"), 0644); err != nil {
		t.Fatal(err)
	}
	_, err := loadGfaidxDatabases(ConfigGfaidx{Databases: databaseDir})
	if err == nil || !strings.Contains(err.Error(), "no .params") {
		t.Fatalf("unregistered graph discovery error = %v", err)
	}
}

// TestGfaidxDatabaseDiscoveryRejectsEscapingPaths keeps server metadata
// portable and prevents a params file from selecting data outside its mount.
func TestGfaidxDatabaseDiscoveryRejectsEscapingPaths(t *testing.T) {
	for name, graphPath := range map[string]string{
		"absolute": filepath.Join(t.TempDir(), "outside.gfa.gz"),
		"parent":   "../outside.gfa.gz",
	} {
		t.Run(name, func(t *testing.T) {
			databaseDir := t.TempDir()
			params := `{"name":"Escaping graph","path":` + strconv.Quote(graphPath) + `}`
			if err := os.WriteFile(filepath.Join(databaseDir, "escape.params"), []byte(params), 0644); err != nil {
				t.Fatal(err)
			}
			if _, err := loadGfaidxDatabases(ConfigGfaidx{Databases: databaseDir}); err == nil {
				t.Fatalf("escaping graph path %q was accepted", graphPath)
			}
		})
	}
}

// TestGfaidxSubgraphJob verifies request normalization, deterministic tickets,
// and the exact safe argument vector passed to get_subgraph.
func TestGfaidxSubgraphJob(t *testing.T) {
	config, graphPath := newTestGfaidxConfig(t)
	input := GfaidxSubgraphRequest{
		GraphID:    "example",
		StartNode:  "node-42",
		MaxNodes:   250,
		Threads:    2,
		WithCoords: true,
	}
	request, err := NewGfaidxSubgraphJobRequest(input, config)
	if err != nil {
		t.Fatal(err)
	}
	second, err := NewGfaidxSubgraphJobRequest(input, config)
	if err != nil {
		t.Fatal(err)
	}
	if request.Id != second.Id || request.Type != JobGfaidx {
		t.Fatalf("unexpected ticket identity: %#v %#v", request, second)
	}

	job, ok := request.Job.(GfaidxJob)
	if !ok {
		t.Fatalf("job type = %T, want GfaidxJob", request.Job)
	}
	graph, err := resolveGfaidxGraph("example", config)
	if err != nil {
		t.Fatal(err)
	}
	got := gfaidxCommand(job, graph, "/jobs/result.gfa.tmp", config)
	want := []string{
		config.Binary, "get_subgraph", graphPath, "node-42", "/jobs/result.gfa.tmp",
		"--max_nodes", "250", "--threads", "2", "--with_coords",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("command = %#v, want %#v", got, want)
	}
}

// TestGfaidxRegionJob verifies all-haplotype normalization and its region-only
// command arguments.
func TestGfaidxRegionJob(t *testing.T) {
	config, graphPath := newTestGfaidxConfig(t)
	request, err := NewGfaidxRegionJobRequest(GfaidxRegionRequest{
		GraphID:       "example",
		Reference:     "CHM13",
		Sequence:      "chr22",
		Start:         100,
		End:           200,
		Threads:       3,
		AllHaplotypes: true,
		HaplotypeGap:  "10kb",
		WithCoords:    true,
	}, config)
	if err != nil {
		t.Fatal(err)
	}
	job := request.Job.(GfaidxJob)
	graph, err := resolveGfaidxGraph("example", config)
	if err != nil {
		t.Fatal(err)
	}
	got := gfaidxCommand(job, graph, "/jobs/result.gfa.tmp", config)
	want := []string{
		config.Binary, "get_region", graphPath, "chr22:100-200", "/jobs/result.gfa.tmp",
		"--all_haplotypes", "--threads", "3", "--reference", "CHM13",
		"--haplotype_gap", "10kb", "--with_coords",
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("command = %#v, want %#v", got, want)
	}
}

// TestGfaidxRequestValidation covers combinations that must fail before a job
// reaches either the queue or the external binary.
func TestGfaidxRequestValidation(t *testing.T) {
	config, _ := newTestGfaidxConfig(t)
	if _, err := NewGfaidxSubgraphJobRequest(GfaidxSubgraphRequest{
		GraphID: "example", StartNode: "node", MaxNodes: 10, NoPaths: true, WithCoords: true,
	}, config); err == nil {
		t.Fatal("no_paths with with_coords was accepted")
	}
	if _, err := NewGfaidxRegionJobRequest(GfaidxRegionRequest{
		GraphID: "example", Sequence: "chr22", Start: 10, End: 20,
	}, config); err == nil {
		t.Fatal("BFS region request without max_nodes was accepted")
	}
	if _, err := NewGfaidxRegionJobRequest(GfaidxRegionRequest{
		GraphID: "example", Sequence: "chr22", Start: 20, End: 10, AllHaplotypes: true,
	}, config); err == nil {
		t.Fatal("reversed region was accepted")
	}
}

// TestGfaidxApiSubmissionAndResult exercises the new HTTP boundary against the
// existing local job queue, then simulates a completed worker output.
func TestGfaidxApiSubmissionAndResult(t *testing.T) {
	gfaidxConfig, _ := newTestGfaidxConfig(t)
	results := t.TempDir()
	config := ConfigRoot{Paths: ConfigPaths{Results: results}, Gfaidx: &gfaidxConfig}
	jobsystem, err := MakeLocalJobSystem(results, false)
	if err != nil {
		t.Fatal(err)
	}

	router := mux.NewRouter()
	submit := func(w http.ResponseWriter, req *http.Request, request JobRequest) {
		ticket, err := jobsystem.NewJob(request, results, false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(ticket)
	}
	RegisterGfaidxApi(router, &jobsystem, config, submit)

	body := bytes.NewBufferString(`{"graph_id":"example","start_node":"node-42","max_nodes":25}`)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/ticket/gfaidx/subgraph", body))
	if recorder.Code != http.StatusOK {
		t.Fatalf("submission status = %d, body = %q", recorder.Code, recorder.Body.String())
	}
	var ticket Ticket
	if err := json.NewDecoder(recorder.Body).Decode(&ticket); err != nil {
		t.Fatal(err)
	}
	if ticket.RawStatus != StatusPending || !ticket.Valid() {
		t.Fatalf("submission ticket = %#v", ticket)
	}

	resultBase := lookupJobDir(results, ticket.Id)
	if err := os.WriteFile(filepath.Join(resultBase, "result.gfa"), []byte("H\tVN:Z:1.1\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if err := jobsystem.SetStatus(ticket.Id, StatusComplete); err != nil {
		t.Fatal(err)
	}

	recorder = httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/result/gfaidx/"+string(ticket.Id), nil))
	if recorder.Code != http.StatusOK || recorder.Body.String() != "H\tVN:Z:1.1\n" {
		t.Fatalf("result status = %d, body = %q", recorder.Code, recorder.Body.String())
	}
	if contentType := recorder.Header().Get("Content-Type"); !strings.HasPrefix(contentType, "text/plain") {
		t.Fatalf("result Content-Type = %q", contentType)
	}
}

// TestGfaidxApiRejectsUnknownJSONFields keeps misspelled client parameters
// from silently producing a different query than intended.
func TestGfaidxApiRejectsUnknownJSONFields(t *testing.T) {
	gfaidxConfig, _ := newTestGfaidxConfig(t)
	config := ConfigRoot{Paths: ConfigPaths{Results: t.TempDir()}, Gfaidx: &gfaidxConfig}
	router := mux.NewRouter()
	RegisterGfaidxApi(router, nil, config, func(http.ResponseWriter, *http.Request, JobRequest) {})

	body := bytes.NewBufferString(`{"graph_id":"example","start_node":"node","max_nodes":10,"max_node":9}`)
	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodPost, "/ticket/gfaidx/subgraph", body))
	if recorder.Code != http.StatusBadRequest || !strings.Contains(recorder.Body.String(), "unknown field") {
		t.Fatalf("status = %d, body = %q", recorder.Code, recorder.Body.String())
	}
}

// TestGfaidxGraphDiscovery verifies the public graph-list response and ensures
// that its server-controlled filesystem path is never exposed.
func TestGfaidxGraphDiscovery(t *testing.T) {
	gfaidxConfig, graphPath := newTestGfaidxConfig(t)
	config := ConfigRoot{Paths: ConfigPaths{Results: t.TempDir()}, Gfaidx: &gfaidxConfig}
	router := mux.NewRouter()
	RegisterGfaidxApi(router, nil, config, func(http.ResponseWriter, *http.Request, JobRequest) {})

	recorder := httptest.NewRecorder()
	router.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/gfaidx/graphs", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("graph discovery status = %d, body = %q", recorder.Code, recorder.Body.String())
	}
	var graphs []GfaidxGraphInfo
	if err := json.NewDecoder(recorder.Body).Decode(&graphs); err != nil {
		t.Fatal(err)
	}
	want := []GfaidxGraphInfo{{ID: "example", Name: "Example graph", Description: "Test graph"}}
	if !reflect.DeepEqual(graphs, want) {
		t.Fatalf("graphs = %#v, want %#v", graphs, want)
	}
	if strings.Contains(recorder.Body.String(), graphPath) {
		t.Fatal("graph discovery response exposed its server filesystem path")
	}
}

// TestGfaidxRegionPathParsing covers the gfaidx TSV-to-JSON conversion used by
// the synchronous discovery endpoint without executing an external binary.
func TestGfaidxRegionPathParsing(t *testing.T) {
	output := "gfaidx informational output\n" +
		"source\treference\thaplotype\tsequence\tstart\tend\tentries\tcoordinate_access\n" +
		"W\tCHM13\t0\tchr22\t0\t51324926\t1439527\ton_the_fly\n"
	paths, err := parseGfaidxRegionPaths(output)
	if err != nil {
		t.Fatal(err)
	}
	want := []GfaidxRegionPath{{
		Source: "W", Reference: "CHM13", Haplotype: "0", Sequence: "chr22",
		Start: 0, End: 51324926, Entries: 1439527,
		Label: "CHM13 hap0 chr22 (0-51324926)",
	}}
	if !reflect.DeepEqual(paths, want) {
		t.Fatalf("region paths = %#v, want %#v", paths, want)
	}
	if _, err := parseGfaidxRegionPaths("not a table\n"); err == nil {
		t.Fatal("invalid region path output was accepted")
	}
}

// TestGfaidxRegionPathCommand verifies that metadata discovery uses only the
// registered graph path and the supported get_region listing flag.
func TestGfaidxRegionPathCommand(t *testing.T) {
	config, graphPath := newTestGfaidxConfig(t)
	graph, err := resolveGfaidxGraph("example", config)
	if err != nil {
		t.Fatal(err)
	}
	got := gfaidxRegionPathCommand(graph, config)
	want := []string{config.Binary, "get_region", graphPath, "--print_path_names"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("command = %#v, want %#v", got, want)
	}
}
