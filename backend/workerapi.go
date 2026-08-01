package main

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/mux"
)

// Server and worker must agree
const WorkerProtocolVersion = 1

const (
	DefaultClaimTimeout = 30 * time.Second
	DefaultWorkerLease  = 1 * time.Hour
)

type WorkerClaimRequest struct {
	Protocol int       `json:"protocol"`
	Worker   string    `json:"worker"`
	Types    []JobType `json:"types"`
}

type WorkerClaimResponse struct {
	Protocol int        `json:"protocol"`
	Id       Id         `json:"id"`
	Type     JobType    `json:"type"`
	Job      JobRequest `json:"job"`
	// the worker refreshes at least this often in seconds
	Lease int `json:"lease"`
}

type WorkerStatusRequest struct {
	Status Status `json:"status"`
	Reason string `json:"reason"`
}

type WorkerStatusResponse struct {
	Status Status `json:"status"`
}

type workerLease struct {
	Type     JobType
	Worker   string
	Deadline time.Time
}

type WorkerRegistry struct {
	mutex        sync.Mutex
	leases       map[Id]*workerLease
	lease        time.Duration
	claimTimeout time.Duration
	jobsystem    JobSystem
}

func NewWorkerRegistry(jobsystem JobSystem, lease time.Duration) *WorkerRegistry {
	return &WorkerRegistry{
		leases:       make(map[Id]*workerLease),
		lease:        lease,
		claimTimeout: DefaultClaimTimeout,
		jobsystem:    jobsystem,
	}
}

func (r *WorkerRegistry) Acquire(id Id, jobtype JobType, worker string) {
	r.mutex.Lock()
	r.leases[id] = &workerLease{jobtype, worker, time.Now().Add(r.lease)}
	r.mutex.Unlock()
}

func (r *WorkerRegistry) Refresh(id Id) bool {
	r.mutex.Lock()
	defer r.mutex.Unlock()
	lease, ok := r.leases[id]
	if !ok {
		return false
	}
	lease.Deadline = time.Now().Add(r.lease)
	return true
}

func (r *WorkerRegistry) Release(id Id) {
	r.mutex.Lock()
	delete(r.leases, id)
	r.mutex.Unlock()
}

func (r *WorkerRegistry) expired(now time.Time) map[Id]JobType {
	stale := make(map[Id]JobType)
	r.mutex.Lock()
	for id, lease := range r.leases {
		if now.After(lease.Deadline) {
			stale[id] = lease.Type
			delete(r.leases, id)
		}
	}
	r.mutex.Unlock()
	return stale
}

func (r *WorkerRegistry) RunJanitor() {
	for {
		interval := r.lease / 4
		if interval < time.Second {
			interval = time.Second
		}
		time.Sleep(interval)
		for id, jobtype := range r.expired(time.Now()) {
			log.Printf("Lease expired for job %s, requeuing\n", string(id))
			if err := r.jobsystem.Requeue(id, jobtype); err != nil {
				log.Print(err)
			}
		}
	}
}

func workerAuthorized(token string, req *http.Request) bool {
	header := req.Header.Get("Authorization")
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	given := strings.TrimSpace(header[len(prefix):])
	return subtle.ConstantTimeCompare([]byte(given), []byte(token)) == 1
}

func WorkerPathPrefix(pathprefix string) string {
	trimmed := strings.Trim(pathprefix, "/")
	if trimmed == "" {
		return "/worker/"
	}
	return "/" + trimmed + "/worker/"
}

func RegisterWorkerApi(r *mux.Router, jobsystem JobSystem, config ConfigRoot, mailer MailTransport) *WorkerRegistry {
	lease := DefaultWorkerLease
	if config.Server.WorkerLease > 0 {
		lease = time.Duration(config.Server.WorkerLease) * time.Second
	}
	registry := NewWorkerRegistry(jobsystem, lease)
	go registry.RunJanitor()

	token := config.Server.WorkerToken
	guard := func(h func(http.ResponseWriter, *http.Request)) func(http.ResponseWriter, *http.Request) {
		return func(w http.ResponseWriter, req *http.Request) {
			if !workerAuthorized(token, req) {
				w.Header().Set("WWW-Authenticate", "Bearer")
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			h(w, req)
		}
	}

	jobDirFor := func(id Id) (string, error) {
		if !(Ticket{Id: id}).Valid() {
			return "", errors.New("invalid ticket id")
		}
		dir := lookupJobDir(filepath.Clean(config.Paths.Results), id)
		if _, err := os.Stat(dir); err != nil {
			return "", err
		}
		return dir, nil
	}

	r.HandleFunc("/worker/claim", guard(func(w http.ResponseWriter, req *http.Request) {
		var claim WorkerClaimRequest
		if err := DecodeJson(req.Body, &claim); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if claim.Protocol != WorkerProtocolVersion {
			http.Error(w, fmt.Sprintf(
				"worker protocol %d does not match server protocol %d, upgrade one of the two",
				claim.Protocol, WorkerProtocolVersion,
			), http.StatusConflict)
			return
		}
		if len(claim.Types) == 0 {
			http.Error(w, "no job types advertised", http.StatusBadRequest)
			return
		}
		for _, t := range claim.Types {
			if !t.Valid() {
				http.Error(w, "unknown job type: "+string(t), http.StatusBadRequest)
				return
			}
		}
		deadline := time.Now().Add(registry.claimTimeout)
		for {
			ticket, err := jobsystem.Dequeue(claim.Types)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}

			if ticket != nil {
				dir := lookupJobDir(filepath.Clean(config.Paths.Results), ticket.Id)
				request, err := getJobRequestFromFile(filepath.Join(dir, "job.json"))
				if err != nil {
					// unreadable job file
					jobsystem.SetStatus(ticket.Id, StatusError)
					log.Print(err)
					continue
				}

				jobsystem.SetStatus(ticket.Id, StatusRunning)
				registry.Acquire(ticket.Id, request.Type, claim.Worker)

				w.Header().Set("Cache-Control", "no-cache, no-store")
				err = json.NewEncoder(w).Encode(WorkerClaimResponse{
					Protocol: WorkerProtocolVersion,
					Id:       ticket.Id,
					Type:     request.Type,
					Job:      request,
					Lease:    int(lease / time.Second),
				})
				if err != nil {
					// The worker never got the claim, so hand the job back
					log.Print(err)
					registry.Release(ticket.Id)
					if err := jobsystem.Requeue(ticket.Id, request.Type); err != nil {
						log.Print(err)
					}
				}
				return
			}

			if time.Now().After(deadline) {
				w.WriteHeader(http.StatusNoContent)
				return
			}
			select {
			case <-req.Context().Done():
				return
			case <-time.After(200 * time.Millisecond):
			}
		}
	})).Methods("POST")

	r.HandleFunc("/worker/job/{ticket}/input", guard(func(w http.ResponseWriter, req *http.Request) {
		dir, err := jobDirFor(Id(mux.Vars(req)["ticket"]))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/x-tar")
		w.Header().Set("Cache-Control", "no-cache, no-store")
		if err := TarJobDir(w, dir); err != nil {
			log.Print(err)
		}
	})).Methods("GET")

	r.HandleFunc("/worker/job/{ticket}/result", guard(func(w http.ResponseWriter, req *http.Request) {
		id := Id(mux.Vars(req)["ticket"])
		dir, err := jobDirFor(id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		staging := dir + ".incoming"
		if err := os.RemoveAll(staging); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		if err := UntarJobDir(req.Body, staging); err != nil {
			os.RemoveAll(staging)
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		err = mergeMove(staging, dir, map[string]bool{"job.json": true})
		os.RemoveAll(staging)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		registry.Refresh(id)
		w.WriteHeader(http.StatusNoContent)
	})).Methods("POST")

	r.HandleFunc("/worker/job/{ticket}/status", guard(func(w http.ResponseWriter, req *http.Request) {
		id := Id(mux.Vars(req)["ticket"])
		if !(Ticket{Id: id}).Valid() {
			http.Error(w, "invalid ticket id", http.StatusBadRequest)
			return
		}

		if req.Method == http.MethodGet {
			status, err := jobsystem.Status(id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			json.NewEncoder(w).Encode(WorkerStatusResponse{status})
			return
		}

		var update WorkerStatusRequest
		if err := DecodeJson(req.Body, &update); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		switch update.Status {
		case StatusRunning:
			registry.Refresh(id)
			if status, err := jobsystem.Status(id); err == nil && status == StatusRunning {
				// plain lease refresh
				w.WriteHeader(http.StatusNoContent)
				return
			}
			if err := jobsystem.SetStatus(id, StatusRunning); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		case StatusComplete, StatusError:
			if err := jobsystem.SetStatus(id, update.Status); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			registry.Release(id)
			// mail lives on the server
			go sendJobMail(config, mailer, id, update.Reason)
		default:
			http.Error(w, "invalid status: "+string(update.Status), http.StatusBadRequest)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	})).Methods("POST", "GET")

	return registry
}

const (
	MailReasonSuccess = "success"
	MailReasonError   = "error"
	MailReasonTimeout = "timeout"
)

func mailTemplateFor(config ConfigRoot, reason string) ConfigMailTemplate {
	switch reason {
	case MailReasonError:
		return config.Mail.Templates.Error
	case MailReasonTimeout:
		return config.Mail.Templates.Timeout
	default:
		return config.Mail.Templates.Success
	}
}

func sendJobMail(config ConfigRoot, mailer MailTransport, id Id, reason string) {
	if mailer == nil {
		return
	}
	request, err := getJobRequestFromFile(filepath.Join(lookupJobDir(config.Paths.Results, id), "job.json"))
	if err != nil || request.Email == "" {
		return
	}
	template := mailTemplateFor(config, reason)
	err = mailer.Send(Mail{
		config.Mail.Sender,
		request.Email,
		fmt.Sprintf(template.Subject, string(id)),
		fmt.Sprintf(template.Body, string(id)),
	})
	if err != nil {
		log.Print(err)
	}
}
