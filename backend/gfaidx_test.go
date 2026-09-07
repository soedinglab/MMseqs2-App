package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"

	"github.com/gorilla/mux"
)

// newTestGfaidxConfig creates a complete server-controlled graph registry
// without depending on the developer's ignored integration-test data.
func newTestGfaidxConfig(t *testing.T) (ConfigGfaidx, string) {
	t.Helper()
	base := t.TempDir()
	graphPath := filepath.Join(base, "graphs", "example.gfa.gz")
	if err := os.MkdirAll(filepath.Dir(graphPath), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(graphPath, []byte("indexed graph"), 0644); err != nil {
		t.Fatal(err)
	}
	registryPath := filepath.Join(base, "graphs.tsv")
	registry := "graph_id\tdisplay_name\tpath\tdescription\tversion\n" +
		"example\tExample graph\tgraphs/example.gfa.gz\tTest graph\tv1\n"
	if err := os.WriteFile(registryPath, []byte(registry), 0644); err != nil {
		t.Fatal(err)
	}
	return ConfigGfaidx{
		Binary:         "/server/bin/gfaidx",
		Registry:       registryPath,
		TimeoutSeconds: 30,
		MaxThreads:     4,
	}, graphPath
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
