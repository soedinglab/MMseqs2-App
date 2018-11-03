package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/goji/httpauth"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

type DatabaseResponse struct {
	Databases []ParamsDisplay `json:"databases"`
}

func server(jobsystem JobSystem, config ConfigRoot) {
	go func() {
		databases, err := Databases(config.Paths.Databases, false)
		if err != nil {
			panic(err)
		}

		for _, db := range databases {
			if db.Status != StatusRunning && db.Status != StatusComplete {
				request, err := NewIndexJobRequest(db.Display.Path, "")
				if err != nil {
					panic(err)
				}

				_, err = jobsystem.NewJob(request, config.Paths.Results)
				if err != nil {
					panic(err)
				}
			}
		}
	}()

	baseRouter := mux.NewRouter()
	var r *mux.Router
	if len(config.Server.PathPrefix) > 0 {
		r = baseRouter.PathPrefix(config.Server.PathPrefix).Subrouter()
	} else {
		r = baseRouter
	}

	r.HandleFunc("/databases", func(w http.ResponseWriter, req *http.Request) {
		databases, err := Databases(config.Paths.Databases, true)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		err = json.NewEncoder(w).Encode(DatabaseResponse{GetDisplayFromParams(databases)})
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

	if config.Server.DbManagment == true {
		r.HandleFunc("/databases/order", func(w http.ResponseWriter, req *http.Request) {
			err := req.ParseForm()
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			paths := req.Form["database[]"]
			databases, err := ReorderDatabases(config.Paths.Databases, paths)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			err = json.NewEncoder(w).Encode(DatabaseResponse{GetDisplayFromParams(databases)})
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		}).Methods("POST")

		r.HandleFunc("/database", func(w http.ResponseWriter, req *http.Request) {
			var request JobRequest

			var data string
			if strings.HasPrefix(req.Header.Get("Content-Type"), "multipart/form-data") {
				err := req.ParseMultipartForm(int64(128 * 1024 * 1024))
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}

				f, _, err := req.FormFile("file")
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}

				buf := new(bytes.Buffer)
				buf.ReadFrom(f)
				data = buf.String()
			} else {
				err := req.ParseForm()
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				data = req.FormValue("file")
			}

			var suffix string
			switch req.FormValue("format") {
			case "fasta":
				suffix = ".fasta"
				break
			case "stockholm":
				suffix = ".sto"
				break
			default:
				http.Error(w, "Invalid database input file", http.StatusBadRequest)
				return
			}

			var path string
			if len(req.FormValue("path")) > 0 {
				path = filepath.Base(req.FormValue("path"))
				if fileExists(filepath.Join(config.Paths.Databases, path+suffix)) == false {
					http.Error(w, "Indicated file does not exist already", http.StatusBadRequest)
					return
				}
			} else {
				path = SafePath(config.Paths.Databases, req.FormValue("name"), req.FormValue("version"))

				f, err := os.Create(filepath.Join(config.Paths.Databases, filepath.Base(path+suffix)))
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				f.WriteString(data)
				f.Close()
			}
			params := Params{
				StatusPending,
				ParamsDisplay{
					req.FormValue("name"),
					req.FormValue("version"),
					path,
					req.FormValue("default") == "true",
					0,
					req.FormValue("search"),
				},
			}

			filename := filepath.Join(config.Paths.Databases, filepath.Base(path+".params"))
			err := SaveParams(filename, params)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			request, err = NewIndexJobRequest(path, req.FormValue("email"))
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			result, err := jobsystem.NewJob(request, config.Paths.Results)
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

		r.HandleFunc("/database", func(w http.ResponseWriter, req *http.Request) {
			err := req.ParseForm()
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			path := req.FormValue("path")
			ok := DeleteDatabase(filepath.Join(config.Paths.Databases, filepath.Base(path)))
			if ok == false {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		}).Methods("DELETE")

	}
	r.HandleFunc("/ticket", func(w http.ResponseWriter, req *http.Request) {
		var request JobRequest

		var query string
		var dbs []string
		var mode string
		var email string

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
			query = buf.String()
			dbs = req.Form["database[]"]
			mode = req.FormValue("mode")
			email = req.FormValue("email")
		} else {
			err := req.ParseForm()
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			query = req.FormValue("q")
			dbs = req.Form["database[]"]
			mode = req.FormValue("mode")
			email = req.FormValue("email")
		}

		databases, err := Databases(config.Paths.Databases, true)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		request, err = NewSearchJobRequest(query, dbs, databases, mode, config.Paths.Results, email)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		result, err := jobsystem.NewJob(request, config.Paths.Results)
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

	r.HandleFunc("/ticket/type/{ticket}", func(w http.ResponseWriter, req *http.Request) {
		ticket, err := jobsystem.GetTicket(Id(mux.Vars(req)["ticket"]))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		request, err := getJobRequestFromFile(filepath.Join(config.Paths.Results, string(ticket.Id), "job.json"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		type TypeReponse struct {
			JobType JobType `json:"type"`
		}

		err = json.NewEncoder(w).Encode(TypeReponse{request.Type})
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

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

		results, err := Alignments(ticket.Id, int64(id), config.Paths.Results)
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
	if config.Server.CORS {
		c := cors.AllowAll()
		h = c.Handler(h)
	}

	srv := &http.Server{
		Handler: h,
		Addr:    config.Server.Address,

		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Println("MMseqs2 Webserver")
	log.Fatal(srv.ListenAndServe())
}
