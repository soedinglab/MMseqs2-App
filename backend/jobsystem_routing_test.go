package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// Ids have to look like a real ticket or validId rejects them.
func testId(seed string) Id {
	padded := seed + strings.Repeat("x", 38)
	return Id(padded[:38])
}

func writeTestJob(t *testing.T, results string, id Id, jobtype JobType, job interface{}, status Status) {
	t.Helper()
	dir := jobDir(results, id)
	if err := os.MkdirAll(dir, 0755); err != nil {
		t.Fatal(err)
	}
	f, err := os.Create(filepath.Join(dir, "job.json"))
	if err != nil {
		t.Fatal(err)
	}
	defer f.Close()
	err = json.NewEncoder(f).Encode(JobRequest{
		Id:     id,
		Status: status,
		Type:   jobtype,
		Job:    job,
	})
	if err != nil {
		t.Fatal(err)
	}
}

func folddiscoJob() FoldDiscoJob {
	return FoldDiscoJob{Size: 1, Database: []string{"pdb_folddisco"}, Motif: "A100"}
}

func rnaSearchJob() RnaSearchJob {
	return RnaSearchJob{Size: 1, Database: []string{"rfam"}, Mode: "accept"}
}

func TestDequeueFiltersByType(t *testing.T) {
	results := t.TempDir()
	disco := testId("disco")
	rna := testId("rna")
	writeTestJob(t, results, disco, JobFoldDisco, folddiscoJob(), StatusPending)
	writeTestJob(t, results, rna, JobRnaSearch, rnaSearchJob(), StatusPending)

	jobsystem, err := MakeLocalJobSystem(results, true)
	if err != nil {
		t.Fatal(err)
	}
	if length, _ := jobsystem.QueueLength(); length != 2 {
		t.Fatalf("queue length = %d, want 2", length)
	}

	ticket, err := jobsystem.Dequeue([]JobType{JobRnaSearch})
	if err != nil {
		t.Fatal(err)
	}
	if ticket == nil || ticket.Id != rna {
		t.Fatalf("dequeued %v, want the rnasearch job", ticket)
	}

	// only the folddisco job is left, so a worker that does not take it gets
	// nothing rather than the wrong job
	ticket, err = jobsystem.Dequeue([]JobType{JobRnaSearch})
	if err != nil {
		t.Fatal(err)
	}
	if ticket != nil {
		t.Fatalf("dequeued %v, want nil", ticket)
	}

	ticket, err = jobsystem.Dequeue([]JobType{JobFoldDisco})
	if err != nil {
		t.Fatal(err)
	}
	if ticket == nil || ticket.Id != disco {
		t.Fatalf("dequeued %v, want the folddisco job", ticket)
	}
}

func TestDequeueNilTypesTakesEverything(t *testing.T) {
	results := t.TempDir()
	writeTestJob(t, results, testId("disco"), JobFoldDisco, folddiscoJob(), StatusPending)

	jobsystem, err := MakeLocalJobSystem(results, true)
	if err != nil {
		t.Fatal(err)
	}
	ticket, err := jobsystem.Dequeue(nil)
	if err != nil {
		t.Fatal(err)
	}
	if ticket == nil {
		t.Fatal("nil filter did not dequeue anything")
	}
}

// The point of local.delegate: a type the server cannot run stays PENDING
// instead of being picked up and failing.
func TestDelegatedTypeStaysPending(t *testing.T) {
	results := t.TempDir()
	disco := testId("disco")
	structure := testId("struct")
	writeTestJob(t, results, disco, JobFoldDisco, folddiscoJob(), StatusPending)
	writeTestJob(t, results, structure, JobStructureSearch, StructureSearchJob{Size: 1, Database: []string{"pdb"}, Mode: "3diaa"}, StatusPending)

	jobsystem, err := MakeLocalJobSystem(results, true)
	if err != nil {
		t.Fatal(err)
	}

	inProcess := SubtractJobTypes(AllJobTypes, []JobType{JobFoldDisco})
	if isInJobTypes(inProcess, JobFoldDisco) {
		t.Fatal("delegated type is still in the in-process set")
	}

	ticket, err := jobsystem.Dequeue(inProcess)
	if err != nil {
		t.Fatal(err)
	}
	if ticket == nil || ticket.Id != structure {
		t.Fatalf("dequeued %v, want the structuresearch job", ticket)
	}

	ticket, err = jobsystem.Dequeue(inProcess)
	if err != nil {
		t.Fatal(err)
	}
	if ticket != nil {
		t.Fatalf("in-process worker took the delegated job %v", ticket)
	}

	status, err := jobsystem.Status(disco)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusPending {
		t.Fatalf("delegated job status = %q, want PENDING", status)
	}

	if length, err := jobsystem.QueueLength(); err != nil || length != 1 {
		t.Fatalf("queue length = %d (%v), want the delegated job still queued", length, err)
	}
}

func TestRequeueRestoresPendingJob(t *testing.T) {
	results := t.TempDir()
	disco := testId("disco")
	writeTestJob(t, results, disco, JobFoldDisco, folddiscoJob(), StatusPending)

	jobsystem, err := MakeLocalJobSystem(results, true)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := jobsystem.Dequeue(nil); err != nil {
		t.Fatal(err)
	}
	if err := jobsystem.SetStatus(disco, StatusRunning); err != nil {
		t.Fatal(err)
	}

	if err := jobsystem.Requeue(disco, JobFoldDisco); err != nil {
		t.Fatal(err)
	}
	status, err := jobsystem.Status(disco)
	if err != nil {
		t.Fatal(err)
	}
	if status != StatusPending {
		t.Fatalf("status after requeue = %q, want PENDING", status)
	}

	// requeuing twice must not duplicate the entry
	if err := jobsystem.Requeue(disco, JobFoldDisco); err != nil {
		t.Fatal(err)
	}
	if length, _ := jobsystem.QueueLength(); length != 1 {
		t.Fatalf("queue length = %d, want 1", length)
	}

	ticket, err := jobsystem.Dequeue([]JobType{JobFoldDisco})
	if err != nil {
		t.Fatal(err)
	}
	if ticket == nil || ticket.Id != disco {
		t.Fatalf("dequeued %v, want the requeued job", ticket)
	}
}

func TestParseJobTypes(t *testing.T) {
	types, err := ParseJobTypes([]string{"folddisco", " rnasearch ", "folddisco", ""})
	if err != nil {
		t.Fatal(err)
	}
	if len(types) != 2 || types[0] != JobFoldDisco || types[1] != JobRnaSearch {
		t.Fatalf("parsed %v", types)
	}

	if _, err := ParseJobTypes([]string{"notatype"}); err == nil {
		t.Fatal("unknown job type was accepted")
	}
}
