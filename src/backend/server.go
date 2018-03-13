package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/goji/httpauth"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func server(jobsystem JobSystem, config ConfigRoot) {
	databaseParams, err := Databases(config.Paths.Databases)
	if err != nil {
		panic(err)
	}

	if len(databaseParams) == 0 {
		panic("No input for databases found!")
	}

	var databases []ParamsDisplay
	for _, db := range databaseParams {
		err = CheckDatabase(db, path.Join(config.Paths.Databases, db.Display.Path), config.Paths.Temporary, config.Paths.Mmseqs, config.Verbose)
		if err != nil {
			panic(err)
		}
		databases = append(databases, db.Display)
	}

	if len(databases) == 0 {
		panic("No search databases found!")
	}

	baseRouter := mux.NewRouter()

	var r *mux.Router
	if len(config.Server.PathPrefix) > 0 {
		r = baseRouter.PathPrefix(config.Server.PathPrefix).Subrouter()
	} else {
		r = baseRouter
	}

	r.HandleFunc("/databases", func(w http.ResponseWriter, req *http.Request) {
		type DatabaseResponse struct {
			Databases []ParamsDisplay `json:"databases"`
		}

		err = json.NewEncoder(w).Encode(DatabaseResponse{databases})
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

	r.HandleFunc("/databases/order", func(w http.ResponseWriter, req *http.Request) {
		type DatabaseResponse struct {
			Databases []ParamsDisplay `json:"databases"`
		}

		err = json.NewEncoder(w).Encode(DatabaseResponse{databases})
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("POST")

	r.HandleFunc("/ticket", func(w http.ResponseWriter, req *http.Request) {
		var request JobRequest
		if strings.HasPrefix(req.Header.Get("Content-Type"), "multipart/form-data") {
			err := req.ParseMultipartForm(int64(128 * 1024 * 1024))
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			f, _, err := req.FormFile("q")
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			buf := new(bytes.Buffer)
			buf.ReadFrom(f)
			q := buf.String()
			request = JobRequest{
				q,
				req.Form["database[]"],
				req.FormValue("mode"),
				req.FormValue("email"),
			}
		} else {
			err := req.ParseForm()
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			request = JobRequest{
				req.FormValue("q"),
				req.Form["database[]"],
				req.FormValue("mode"),
				req.FormValue("email"),
			}
		}

		result, err := jobsystem.NewJob(request, databases, config.Paths.Results)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		err = json.NewEncoder(w).Encode(result)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("POST")

	r.HandleFunc("/ticket/{ticket}", func(w http.ResponseWriter, req *http.Request) {
		ticket, err := jobsystem.GetTicket(Id(mux.Vars(req)["ticket"]))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		err = json.NewEncoder(w).Encode(ticket)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

	r.HandleFunc("/tickets", func(w http.ResponseWriter, req *http.Request) {
		err := req.ParseForm()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		res, err := jobsystem.MultiStatus(req.Form["tickets[]"])
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		err = json.NewEncoder(w).Encode(res)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("POST")

	r.HandleFunc("/result/download/{ticket}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		ticket, err := jobsystem.GetTicket(Id(vars["ticket"]))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		status, err := jobsystem.Status(ticket.Id)
		if err != nil || status != StatusComplete {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		name := "mmseqs_results_" + string(ticket.Id) + ".tar.gz"
		path := filepath.Join(filepath.Clean(config.Paths.Results), string(ticket.Id), name)
		if _, err := os.Stat(path); os.IsNotExist(err) {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		file, err := os.Open(path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		defer file.Close()

		w.Header().Set("Content-Disposition", "attachment; filename=\""+name+"\"")
		w.Header().Set("Content-Type", "application/octet-stream")
		io.Copy(w, bufio.NewReader(file))
	}).Methods("GET")

	r.HandleFunc("/result/{ticket}/{entry}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		id, err := strconv.ParseUint(vars["entry"], 10, 64)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		ticket, err := jobsystem.GetTicket(Id(vars["ticket"]))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		status, err := jobsystem.Status(ticket.Id)
		if err != nil || status != StatusComplete {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		results, err := Alignments(ticket, int64(id), config.Paths.Results)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		err = json.NewEncoder(w).Encode(results)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

	}).Methods("GET")

	r.HandleFunc("/result/queries/{ticket}/{limit}/{page}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		ticket, err := jobsystem.GetTicket(Id(vars["ticket"]))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		limit, err := strconv.ParseUint(vars["limit"], 10, 32)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		page, err := strconv.ParseUint(vars["page"], 10, 32)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		result, err := Lookup(ticket.Id, page, limit, config.Paths.Results)
		err = json.NewEncoder(w).Encode(result)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

	h := http.Handler(r)
	if config.Server.Auth != nil {
		h = httpauth.SimpleBasicAuth(config.Server.Auth.Username, config.Server.Auth.Password)(h)
	}
	if config.Verbose {
		h = handlers.LoggingHandler(os.Stdout, h)
	}
	c := cors.AllowAll()
	h = c.Handler(h)

	srv := &http.Server{
		Handler: h,
		Addr:    config.Server.Address,

		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Println("MMseqs Webserver")
	log.Fatal(srv.ListenAndServe())
}
