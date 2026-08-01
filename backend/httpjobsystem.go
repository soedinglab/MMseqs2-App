package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// HttpJobSystem is the JobSystem for a remote worker to connect
// to the server without shared NFS or Redis
type HttpJobSystem struct {
	Base    string
	Token   string
	Name    string
	Types   []JobType
	Results string
	Client  *http.Client

	lease time.Duration
}

var ErrProtocolMismatch = errors.New("worker protocol mismatch")

type StagingJobSystem interface {
	SetStatus(Id, Status) error
	StageInput(Id) error
	UploadResult(Id) error
	FinishJob(Id, Status, string) error
	Lease() time.Duration
	Discard(Id) error
}

func MakeHttpJobSystem(config ConfigRoot) (*HttpJobSystem, error) {
	if config.Worker.Remote == "" {
		return nil, errors.New("no remote server configured")
	}
	if config.Worker.Token == "" {
		return nil, errors.New("no worker token configured, set -token or worker.token")
	}
	if len(config.Worker.Types) == 0 {
		return nil, errors.New("no job types advertised, set -types or worker.types")
	}
	for _, t := range config.Worker.Types {
		if !t.Valid() {
			return nil, errors.New("unknown job type: " + string(t))
		}
	}

	base, err := url.Parse(config.Worker.Remote)
	if err != nil {
		return nil, err
	}

	base.Path = strings.TrimSuffix(base.Path, "/") + WorkerPathPrefix(config.Server.PathPrefix)

	name := config.Worker.Name
	if name == "" {
		if hostname, err := os.Hostname(); err == nil {
			name = hostname
		} else {
			name = "worker"
		}
	}

	return &HttpJobSystem{
		Base:    base.String(),
		Token:   config.Worker.Token,
		Name:    name,
		Types:   config.Worker.Types,
		Results: config.Paths.Results,
		// long enough for the server side long-poll to answer 204
		Client: &http.Client{Timeout: 0},
		lease:  DefaultWorkerLease,
	}, nil
}

func (j *HttpJobSystem) url(parts ...string) string {
	return j.Base + strings.Join(parts, "/")
}

func (j *HttpJobSystem) do(method string, url string, contentType string, body io.Reader) (*http.Response, error) {
	req, err := http.NewRequest(method, url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+j.Token)
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	return j.Client.Do(req)
}

func drain(res *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(res.Body, 4096))
	res.Body.Close()
	message := strings.TrimSpace(string(body))
	if message == "" {
		message = res.Status
	}
	return fmt.Errorf("%s: %s", res.Status, message)
}

func (j *HttpJobSystem) Dequeue(types []JobType) (*Ticket, error) {
	if types == nil {
		types = j.Types
	}
	body, err := json.Marshal(WorkerClaimRequest{
		Protocol: WorkerProtocolVersion,
		Worker:   j.Name,
		Types:    types,
	})
	if err != nil {
		return nil, err
	}

	res, err := j.do(http.MethodPost, j.url("claim"), "application/json", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	if res.StatusCode == http.StatusNoContent {
		res.Body.Close()
		return nil, nil
	}
	if res.StatusCode == http.StatusConflict {
		return nil, fmt.Errorf("%w: %s", ErrProtocolMismatch, drain(res))
	}
	if res.StatusCode != http.StatusOK {
		return nil, drain(res)
	}

	var claim WorkerClaimResponse
	err = json.NewDecoder(res.Body).Decode(&claim)
	res.Body.Close()
	if err != nil {
		return nil, err
	}
	if claim.Lease > 0 {
		j.lease = time.Duration(claim.Lease) * time.Second
	}

	return &Ticket{claim.Id, StatusRunning}, nil
}

func (j *HttpJobSystem) Lease() time.Duration {
	return j.lease
}

func (j *HttpJobSystem) setStatus(id Id, status Status, reason string) error {
	body, err := json.Marshal(WorkerStatusRequest{status, reason})
	if err != nil {
		return err
	}
	res, err := j.do(http.MethodPost, j.url("job", string(id), "status"), "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	if res.StatusCode >= 300 {
		return drain(res)
	}
	res.Body.Close()
	return nil
}

func (j *HttpJobSystem) SetStatus(id Id, status Status) error {
	return j.setStatus(id, status, "")
}

// Terminal status plus which mail template the server should use.
func (j *HttpJobSystem) FinishJob(id Id, status Status, reason string) error {
	return j.setStatus(id, status, reason)
}

func (j *HttpJobSystem) Status(id Id) (Status, error) {
	res, err := j.do(http.MethodGet, j.url("job", string(id), "status"), "", nil)
	if err != nil {
		return StatusError, err
	}
	if res.StatusCode != http.StatusOK {
		return StatusError, drain(res)
	}
	var status WorkerStatusResponse
	err = json.NewDecoder(res.Body).Decode(&status)
	res.Body.Close()
	if err != nil {
		return StatusError, err
	}
	return status.Status, nil
}

func (j *HttpJobSystem) GetTicket(id Id) (Ticket, error) {
	t := Ticket{id, StatusUnknown}
	if !t.Valid() {
		return t, errors.New("invalid ID")
	}
	status, err := j.Status(id)
	t.RawStatus = status
	return t, err
}

func (j *HttpJobSystem) MultiStatus(ids []string) ([]Ticket, error) {
	tickets := make([]Ticket, 0, len(ids))
	for _, id := range ids {
		if !validId(id) {
			continue
		}
		status, _ := j.Status(Id(id))
		tickets = append(tickets, Ticket{Id(id), status})
	}
	return tickets, nil
}

func (j *HttpJobSystem) NewJob(request JobRequest, jobsbase string, allowResubmit bool) (Ticket, error) {
	return Ticket{request.Id, StatusError}, errors.New("remote workers cannot submit jobs")
}

func (j *HttpJobSystem) Requeue(id Id, jobtype JobType) error {
	return errors.New("remote workers cannot requeue jobs")
}

func (j *HttpJobSystem) QueueLength() (int, error) {
	return 0, errors.New("remote workers cannot inspect the queue")
}

func (j *HttpJobSystem) StageInput(id Id) error {
	res, err := j.do(http.MethodGet, j.url("job", string(id), "input"), "", nil)
	if err != nil {
		return err
	}
	if res.StatusCode != http.StatusOK {
		return drain(res)
	}
	defer res.Body.Close()

	dir := jobDir(j.Results, id)
	if err := os.RemoveAll(dir); err != nil {
		return err
	}
	return UntarJobDir(res.Body, dir)
}

func (j *HttpJobSystem) UploadResult(id Id) error {
	dir := lookupJobDir(j.Results, id)
	if _, err := os.Stat(dir); err != nil {
		return err
	}

	reader, writer := io.Pipe()
	go func() {
		writer.CloseWithError(TarJobDir(writer, dir))
	}()

	res, err := j.do(http.MethodPost, j.url("job", string(id), "result"), "application/x-tar", reader)
	reader.Close()
	if err != nil {
		return err
	}
	if res.StatusCode >= 300 {
		return drain(res)
	}
	res.Body.Close()
	return nil
}

func (j *HttpJobSystem) Discard(id Id) error {
	return removeJobDir(j.Results, id)
}
