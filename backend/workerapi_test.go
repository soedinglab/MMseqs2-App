package main

import (
	"bytes"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/gorilla/mux"
)

// Stands in for a worker that disconnects between claiming a job and reading the response.
type brokenWriter struct{ header http.Header }

func (w *brokenWriter) Header() http.Header {
	if w.header == nil {
		w.header = http.Header{}
	}
	return w.header
}
func (w *brokenWriter) Write([]byte) (int, error) { return 0, errors.New("client gone") }
func (w *brokenWriter) WriteHeader(int)           {}

type remoteFixture struct {
	server        *httptest.Server
	serverResults string
	workerResults string
	jobsystem     *LocalJobSystem
	registry      *WorkerRegistry
	client        *HttpJobSystem
	config        ConfigRoot
}

func newRemoteFixture(t *testing.T, lease time.Duration) *remoteFixture {
	t.Helper()

	serverResults := t.TempDir()
	workerResults := t.TempDir()

	config := ConfigRoot{App: AppFoldseek}
	config.Paths.Results = serverResults
	config.Paths.Databases = t.TempDir()
	config.Server.PathPrefix = "/api/"
	config.Server.WorkerToken = "s3cret"
	config.Server.WorkerLease = int(lease / time.Second)
	config.Local.Delegate = []JobType{JobFoldDisco}

	jobsystem, err := MakeLocalJobSystem(serverResults, false)
	if err != nil {
		t.Fatal(err)
	}

	base := mux.NewRouter()
	r := base.PathPrefix("/api/").Subrouter()
	registry := RegisterWorkerApi(r, &jobsystem, config, NullTransport{})
	registry.claimTimeout = time.Second
	ts := httptest.NewServer(base)
	t.Cleanup(ts.Close)

	workerConfig := config
	workerConfig.Paths.Results = workerResults
	workerConfig.Worker.Remote = ts.URL
	workerConfig.Worker.Token = "s3cret"
	workerConfig.Worker.Types = []JobType{JobFoldDisco}
	workerConfig.Worker.Name = "gb10"

	client, err := MakeHttpJobSystem(workerConfig)
	if err != nil {
		t.Fatal(err)
	}

	return &remoteFixture{ts, serverResults, workerResults, &jobsystem, registry, client, config}
}

func (f *remoteFixture) submit(t *testing.T, id Id, jobtype JobType, job interface{}) {
	t.Helper()
	writeTestJob(t, f.serverResults, id, jobtype, job, StatusPending)
	writeFile(t, filepath.Join(jobDir(f.serverResults, id), "job.pdb"), "ATOM query")
	if err := f.jobsystem.Requeue(id, jobtype); err != nil {
		t.Fatal(err)
	}
}

func TestRemoteWorkerRoundTrip(t *testing.T) {
	f := newRemoteFixture(t, 30*time.Second)
	id := testId("disco")
	f.submit(t, id, JobFoldDisco, folddiscoJob())

	ticket, err := f.client.Dequeue(nil)
	if err != nil {
		t.Fatal(err)
	}
	if ticket == nil || ticket.Id != id {
		t.Fatalf("claimed %v, want %s", ticket, id)
	}
	if status, _ := f.jobsystem.Status(id); status != StatusRunning {
		t.Fatalf("status after claim = %q, want RUNNING", status)
	}

	if err := f.client.StageInput(id); err != nil {
		t.Fatal(err)
	}
	workerDir := lookupJobDir(f.workerResults, id)
	for _, name := range []string{"job.json", "job.pdb"} {
		if !fileExists(filepath.Join(workerDir, name)) {
			t.Fatalf("%s was not staged onto the worker", name)
		}
	}

	writeFile(t, filepath.Join(workerDir, "alis_pdb_folddisco"), "hits")
	writeFile(t, filepath.Join(workerDir, "pdb_pdb_folddisco", "1abc.pdb"), "ATOM hit")
	writeFile(t, filepath.Join(workerDir, "tmp0", "scratch"), "junk")

	if err := f.client.UploadResult(id); err != nil {
		t.Fatal(err)
	}

	serverDir := lookupJobDir(f.serverResults, id)
	if got, err := os.ReadFile(filepath.Join(serverDir, "alis_pdb_folddisco")); err != nil || string(got) != "hits" {
		t.Fatalf("result not on the server: %v %q", err, got)
	}
	if !fileExists(filepath.Join(serverDir, "pdb_pdb_folddisco", "1abc.pdb")) {
		t.Fatal("nested result directory did not arrive")
	}
	if fileExists(filepath.Join(serverDir, "tmp0")) {
		t.Fatal("scratch directory was uploaded")
	}
	if fileExists(serverDir + ".incoming") {
		t.Fatal("staging directory was left behind")
	}

	if err := f.client.FinishJob(id, StatusComplete, MailReasonSuccess); err != nil {
		t.Fatal(err)
	}
	if status, _ := f.jobsystem.Status(id); status != StatusComplete {
		t.Fatalf("status after finish = %q, want COMPLETE", status)
	}

	request, err := getJobRequestFromFile(filepath.Join(serverDir, "job.json"))
	if err != nil {
		t.Fatal(err)
	}
	if request.Type != JobFoldDisco || request.Status != StatusComplete {
		t.Fatalf("job.json = %+v", request)
	}

	if err := f.client.Discard(id); err != nil {
		t.Fatal(err)
	}
	if fileExists(workerDir) {
		t.Fatal("worker job folder was not wiped")
	}
}

func TestClaimReturnsNoContentWhenNothingMatches(t *testing.T) {
	f := newRemoteFixture(t, 30*time.Second)
	id := testId("rna")
	f.submit(t, id, JobRnaSearch, rnaSearchJob())

	done := make(chan *Ticket, 1)
	go func() {
		ticket, _ := f.client.Dequeue([]JobType{JobFoldDisco})
		done <- ticket
	}()

	select {
	case ticket := <-done:
		if ticket != nil {
			t.Fatalf("claimed %v, want nothing", ticket)
		}
	case <-time.After(30 * time.Second):
		t.Fatal("claim did not time out")
	}

	if status, _ := f.jobsystem.Status(id); status != StatusPending {
		t.Fatalf("status = %q, want PENDING", status)
	}
}

func TestWorkerApiRejectsBadToken(t *testing.T) {
	f := newRemoteFixture(t, 30*time.Second)
	body := bytes.NewBufferString(`{"protocol":1,"worker":"gb10","types":["folddisco"]}`)
	req, err := http.NewRequest(http.MethodPost, f.server.URL+"/api/worker/claim", body)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer wrong")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", res.StatusCode)
	}
}

func TestWorkerApiRejectsProtocolSkew(t *testing.T) {
	f := newRemoteFixture(t, 30*time.Second)
	body := bytes.NewBufferString(`{"protocol":999,"worker":"gb10","types":["folddisco"]}`)
	req, err := http.NewRequest(http.MethodPost, f.server.URL+"/api/worker/claim", body)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer s3cret")
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusConflict {
		t.Fatalf("status = %d, want 409", res.StatusCode)
	}
}

// A worker that dies mid-job must not strand the ticket in RUNNING.
func TestExpiredLeaseRequeuesJob(t *testing.T) {
	f := newRemoteFixture(t, time.Second)
	id := testId("disco")
	f.submit(t, id, JobFoldDisco, folddiscoJob())

	ticket, err := f.client.Dequeue(nil)
	if err != nil || ticket == nil {
		t.Fatalf("claim failed: %v %v", ticket, err)
	}
	if status, _ := f.jobsystem.Status(id); status != StatusRunning {
		t.Fatal("job was not marked RUNNING on claim")
	}

	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		if status, _ := f.jobsystem.Status(id); status == StatusPending {
			if length, _ := f.jobsystem.QueueLength(); length != 1 {
				t.Fatalf("queue length = %d, want the job back", length)
			}
			return
		}
		time.Sleep(50 * time.Millisecond)
	}
	t.Fatal("janitor did not requeue the abandoned job")
}

func TestLeaseRefreshKeepsJobClaimed(t *testing.T) {
	f := newRemoteFixture(t, 2*time.Second)
	id := testId("disco")
	f.submit(t, id, JobFoldDisco, folddiscoJob())

	if _, err := f.client.Dequeue(nil); err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 6; i++ {
		time.Sleep(500 * time.Millisecond)
		if err := f.client.SetStatus(id, StatusRunning); err != nil {
			t.Fatal(err)
		}
	}

	if status, _ := f.jobsystem.Status(id); status != StatusRunning {
		t.Fatalf("status = %q, want RUNNING while the worker keeps reporting", status)
	}
}

// A claim the worker never receives must not strand the job
func TestClaimRequeuesWhenTheResponseNeverArrives(t *testing.T) {
	f := newRemoteFixture(t, 30*time.Second)
	id := testId("disco")
	f.submit(t, id, JobFoldDisco, folddiscoJob())

	// served directly so the response can fail mid-write, which a real client cannot do
	base := mux.NewRouter()
	r := base.PathPrefix("/api/").Subrouter()
	RegisterWorkerApi(r, f.jobsystem, f.config, NullTransport{})

	body := bytes.NewBufferString(`{"protocol":1,"worker":"gb10","types":["folddisco"]}`)
	req := httptest.NewRequest(http.MethodPost, "/api/worker/claim", body)
	req.Header.Set("Authorization", "Bearer s3cret")
	base.ServeHTTP(&brokenWriter{}, req)

	if status, _ := f.jobsystem.Status(id); status != StatusPending {
		t.Fatalf("status = %q, want PENDING after the claim was lost", status)
	}
	if length, err := f.jobsystem.QueueLength(); err != nil || length != 1 {
		t.Fatalf("queue length = %d (%v), want the job back in the queue", length, err)
	}

	// and it is claimable again
	ticket, err := f.client.Dequeue([]JobType{JobFoldDisco})
	if err != nil {
		t.Fatal(err)
	}
	if ticket == nil || ticket.Id != id {
		t.Fatalf("reclaimed %v, want %s", ticket, id)
	}
}

func TestRemoteJobSystemRejectsIncompleteConfig(t *testing.T) {
	base := ConfigRoot{App: AppFoldseek}
	base.Worker.Remote = "http://localhost:1"
	base.Worker.Token = "t"
	base.Worker.Types = []JobType{JobFoldDisco}

	if _, err := MakeHttpJobSystem(base); err != nil {
		t.Fatalf("valid config rejected: %v", err)
	}

	noToken := base
	noToken.Worker.Token = ""
	if _, err := MakeHttpJobSystem(noToken); err == nil {
		t.Error("missing token was accepted")
	}

	noTypes := base
	noTypes.Worker.Types = nil
	if _, err := MakeHttpJobSystem(noTypes); err == nil {
		t.Error("missing types was accepted")
	}

	badType := base
	badType.Worker.Types = []JobType{"notatype"}
	if _, err := MakeHttpJobSystem(badType); err == nil {
		t.Error("unknown job type was accepted")
	}
}

func TestWorkerPathPrefix(t *testing.T) {
	cases := map[string]string{
		"/api/": "/api/worker/",
		"api":   "/api/worker/",
		"":      "/worker/",
		"/":     "/worker/",
	}
	for prefix, want := range cases {
		if got := WorkerPathPrefix(prefix); got != want {
			t.Errorf("WorkerPathPrefix(%q) = %q, want %q", prefix, got, want)
		}
	}
}
