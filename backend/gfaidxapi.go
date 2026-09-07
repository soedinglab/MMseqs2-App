package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"

	"github.com/gorilla/mux"
)

// gfaidxSubmitJobFunc lets the isolated gfaidx routes reuse the server's
// existing rate limiting and queue submission behavior.
type gfaidxSubmitJobFunc func(http.ResponseWriter, *http.Request, JobRequest)

// decodeGfaidxRequest accepts one small JSON object and rejects unknown fields,
// trailing JSON values, and unexpectedly large request bodies.
func decodeGfaidxRequest(w http.ResponseWriter, req *http.Request, target interface{}) error {
	req.Body = http.MaxBytesReader(w, req.Body, 64*1024)
	decoder := json.NewDecoder(req.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		if err == nil {
			return errors.New("request body must contain exactly one JSON object")
		}
		return err
	}
	return nil
}

// RegisterGfaidxApi installs only the optional gfaidx submission and result
// endpoints. It does not replace or alter existing MMseqs API handlers.
func RegisterGfaidxApi(r *mux.Router, jobsystem JobSystem, config ConfigRoot, submit gfaidxSubmitJobFunc) {
	if config.Gfaidx == nil {
		return
	}

	// POST /ticket/gfaidx/subgraph creates a queued get_subgraph job.
	r.HandleFunc("/ticket/gfaidx/subgraph", func(w http.ResponseWriter, req *http.Request) {
		var input GfaidxSubgraphRequest
		if err := decodeGfaidxRequest(w, req, &input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		request, err := NewGfaidxSubgraphJobRequest(input, *config.Gfaidx)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		submit(w, req, request)
	}).Methods(http.MethodPost)

	// POST /ticket/gfaidx/region creates a queued get_region job.
	r.HandleFunc("/ticket/gfaidx/region", func(w http.ResponseWriter, req *http.Request) {
		var input GfaidxRegionRequest
		if err := decodeGfaidxRequest(w, req, &input); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		request, err := NewGfaidxRegionJobRequest(input, *config.Gfaidx)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		submit(w, req, request)
	}).Methods(http.MethodPost)

	// GET /result/gfaidx/{ticket} streams the GFA only after successful completion.
	r.HandleFunc("/result/gfaidx/{ticket}", func(w http.ResponseWriter, req *http.Request) {
		ticket, err := jobsystem.GetTicket(Id(mux.Vars(req)["ticket"]))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		resultBase := lookupJobDir(filepath.Clean(config.Paths.Results), ticket.Id)
		request, err := getJobRequestFromFile(filepath.Join(resultBase, "job.json"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if request.Type != JobGfaidx {
			http.Error(w, "ticket is not a gfaidx job", http.StatusBadRequest)
			return
		}

		if ticket.RawStatus == StatusError {
			// Return a bounded, user-facing worker error when one was recorded.
			message, readErr := os.ReadFile(filepath.Join(resultBase, "job.err"))
			if readErr == nil && len(message) > 0 {
				http.Error(w, string(message), http.StatusUnprocessableEntity)
				return
			}
			http.Error(w, "gfaidx job failed", http.StatusUnprocessableEntity)
			return
		}
		if ticket.RawStatus != StatusComplete {
			http.Error(w, "job is not complete", http.StatusConflict)
			return
		}

		file, err := os.Open(filepath.Join(resultBase, "result.gfa"))
		if err != nil {
			http.Error(w, "gfaidx result was not found", http.StatusInternalServerError)
			return
		}
		defer file.Close()

		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.Header().Set("Content-Disposition", "inline; filename=\"gfaidx_"+string(ticket.Id)+".gfa\"")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		if _, err := io.Copy(w, bufio.NewReader(file)); err != nil {
			return
		}
	}).Methods(http.MethodGet)
}
