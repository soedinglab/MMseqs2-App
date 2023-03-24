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

	"github.com/CAFxX/httpcompression"
	"github.com/didip/tollbooth/v6"
	"github.com/didip/tollbooth/v6/limiter"
	"github.com/goji/httpauth"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

type DatabaseResponse struct {
	Databases []Params `json:"databases"`
}

func CorsCache(h http.Handler, maxAge int) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodOptions && r.Header.Get("Access-Control-Request-Method") != "" {
			strAge := strconv.Itoa(maxAge)
			w.Header().Set("Cache-Control", "public, max-age="+strAge)
			w.Header().Set("Access-Control-Max-Age", strAge)
		}
		h.ServeHTTP(w, r)
	})
}

func server(jobsystem JobSystem, config ConfigRoot) {
	go func() {
		databases, err := Databases(config.Paths.Databases, false)
		if err != nil {
			panic(err)
		}

		for _, db := range databases {
			if db.Status == StatusRunning {
				continue
			}

			request, err := NewIndexJobRequest(db.Path, "")
			if err != nil {
				panic(err)
			}

			_, err = jobsystem.NewJob(request, config.Paths.Results, true)
			if err != nil {
				panic(err)
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

	r.Use(Decompress)

	// skip zstd for now since its not supported everywhere (e.g. firefox)
	compressHandler, err := httpcompression.Adapter(
		httpcompression.DeflateCompressionLevel(6),
		httpcompression.GzipCompressionLevel(6),
		httpcompression.BrotliCompressionLevel(6),
		httpcompression.MinSize(1024),
	)
	if err != nil {
		panic(err)
	}

	databasesHandler := func(complete bool) func(http.ResponseWriter, *http.Request) {
		return func(w http.ResponseWriter, req *http.Request) {
			databases, err := Databases(config.Paths.Databases, complete)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			err = json.NewEncoder(w).Encode(DatabaseResponse{databases})
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		}
	}
	r.HandleFunc("/databases", databasesHandler(true)).Methods("GET")
	r.HandleFunc("/databases/all", databasesHandler(false)).Methods("GET")

	if config.Server.DbManagment {
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

			err = json.NewEncoder(w).Encode(DatabaseResponse{databases})
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
			case "stockholm":
				suffix = ".sto"
			default:
				http.Error(w, "Invalid database input file", http.StatusBadRequest)
				return
			}

			var path string
			if len(req.FormValue("path")) > 0 {
				path = filepath.Base(req.FormValue("path"))
				if !fileExists(filepath.Join(config.Paths.Databases, path+suffix)) {
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
				_, err = f.WriteString(data)
				if err != nil {
					f.Close()
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				err = f.Close()
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
			}
			params := Params{
				req.FormValue("name"),
				req.FormValue("version"),
				path,
				req.FormValue("default") == "true",
				0,
				false,
				false,
				req.FormValue("index"),
				req.FormValue("search"),
				StatusPending,
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
			result, err := jobsystem.NewJob(request, config.Paths.Results, true)
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
			var path string
			if strings.HasPrefix(req.Header.Get("Content-Type"), "application/json") {
				type DatabaseRequest struct {
					Path string `json:"path"`
				}
				var body DatabaseRequest
				if err := DecodeJsonAndValidate(req.Body, &body); err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				path = body.Path
			} else {
				err := req.ParseForm()
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}

				path = req.FormValue("path")
			}
			ok := DeleteDatabase(filepath.Join(config.Paths.Databases, filepath.Base(path)))
			if !ok {
				http.Error(w, "Delete request failed", http.StatusBadRequest)
				return
			}
		}).Methods("DELETE")

	}
	ticketHandlerFunc := func(w http.ResponseWriter, req *http.Request) {
		var query string
		var dbs []string
		var mode string
		var email string
		var taxfilter string

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
			taxfilter = req.FormValue("taxfilter")
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
			taxfilter = req.FormValue("taxfilter")
		}

		databases, err := Databases(config.Paths.Databases, true)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		var request JobRequest
		if config.App == AppMMseqs2 {
			request, err = NewSearchJobRequest(query, dbs, databases, mode, config.Paths.Results, email, taxfilter)
		} else if config.App == AppFoldSeek {
			request, err = NewStructureSearchJobRequest(query, dbs, databases, mode, config.Paths.Results, email, taxfilter)
		} else {
			http.Error(w, "Job type not supported by this server", http.StatusBadRequest)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		result, err := jobsystem.NewJob(request, config.Paths.Results, false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		err = json.NewEncoder(w).Encode(result)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	ticketMsaHandlerFunc := func(w http.ResponseWriter, req *http.Request) {
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

		request, err = NewMsaJobRequest(query, dbs, databases, mode, config.Paths.Results, email)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		result, err := jobsystem.NewJob(request, config.Paths.Results, false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		err = json.NewEncoder(w).Encode(result)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	ticketPairHandlerFunc := func(w http.ResponseWriter, req *http.Request) {
		var request JobRequest

		var query string
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
			mode = req.FormValue("mode")
			email = req.FormValue("email")
		} else {
			err := req.ParseForm()
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			query = req.FormValue("q")
			mode = req.FormValue("mode")
			email = req.FormValue("email")
		}

		request, err := NewPairJobRequest(query, mode, email)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		result, err := jobsystem.NewJob(request, config.Paths.Results, false)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		err = json.NewEncoder(w).Encode(result)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}

	if config.Server.RateLimit != nil {
		type RateLimitResponse struct {
			Status string `json:"status"`
			Reason string `json:"reason"`
		}
		b, err := json.Marshal(RateLimitResponse{
			Status: "RATELIMIT",
			Reason: config.Server.RateLimit.Reason,
		})
		if err != nil {
			panic(err)
		}
		lmt := tollbooth.NewLimiter(config.Server.RateLimit.Rate, &limiter.ExpirableOptions{DefaultExpirationTTL: time.Duration(config.Server.RateLimit.TTL) * time.Hour}).
			SetBurst(config.Server.RateLimit.Burst).
			SetMessageContentType("application/json; charset=utf-8").
			SetMessage(string(b))
		if config.App == AppMMseqs2 || config.App == AppFoldSeek {
			r.Handle("/ticket", tollbooth.LimitFuncHandler(lmt, ticketHandlerFunc)).Methods("POST")
		}
		if config.App == AppColabFold || config.App == AppPredictProtein {
			r.Handle("/ticket/msa", tollbooth.LimitFuncHandler(lmt, ticketMsaHandlerFunc)).Methods("POST")
		}
		if config.App == AppColabFold {
			r.Handle("/ticket/pair", tollbooth.LimitFuncHandler(lmt, ticketPairHandlerFunc)).Methods("POST")
		}
	} else {
		if config.App == AppMMseqs2 || config.App == AppFoldSeek {
			r.HandleFunc("/ticket", ticketHandlerFunc).Methods("POST")
		}
		if config.App == AppColabFold || config.App == AppPredictProtein {
			r.HandleFunc("/ticket/msa", ticketMsaHandlerFunc).Methods("POST")
		}
		if config.App == AppColabFold {
			r.HandleFunc("/ticket/pair", ticketPairHandlerFunc).Methods("POST")
		}
	}

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

		w.Header().Set("Cache-Control", "public, max-age=3600")
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

		w.Header().Set("Cache-Control", "no-cache, no-store")
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
		w.Header().Set("Cache-Control", "public, max-age=3600")
		io.Copy(w, bufio.NewReader(file))
	}).Methods("GET")

	queryHandler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		ticket, err := jobsystem.GetTicket(Id(vars["ticket"]))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		var suffix string
		switch config.App {
		case "foldseek":
			suffix = ".pdb"
		default:
			suffix = ".fasta"
		}
		query, err := os.ReadFile(filepath.Join(config.Paths.Results, string(ticket.Id), "job"+suffix))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.Write(query)
	})
	r.Handle("/result/{ticket}/query", compressHandler(queryHandler)).Methods("GET")

	resultHandler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
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
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if status != StatusComplete {
			http.Error(w, "Job is not complete", http.StatusBadRequest)
			return
		}

		var results AlignmentResponse
		switch config.App {
		case "foldseek":
			results, err = FSAlignments(ticket.Id, int64(id), config.Paths.Results)
		default:
			results, err = Alignments(ticket.Id, int64(id), config.Paths.Results)
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		request, err := getJobRequestFromFile(filepath.Join(config.Paths.Results, string(ticket.Id), "job.json"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		var mode string
		switch job := request.Job.(type) {
		case SearchJob:
			mode = job.Mode
		case StructureSearchJob:
			mode = job.Mode
		case MsaJob:
			mode = job.Mode
		case PairJob:
			mode = job.Mode
		default:
			mode = ""
		}
		type AlignmentModeResponse struct {
			Query   FastaEntry     `json:"query"`
			Mode    string         `json:"mode"`
			Results []SearchResult `json:"results"`
		}

		w.Header().Set("Cache-Control", "public, max-age=3600")
		err = json.NewEncoder(w).Encode(AlignmentModeResponse{results.Query, mode, results.Results})
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

	})
	r.Handle("/result/{ticket}/{entry}", compressHandler(resultHandler)).Methods("GET")

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

		w.Header().Set("Cache-Control", "public, max-age=3600")
		result, err := Lookup(ticket.Id, page, limit, config.Paths.Results)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		err = json.NewEncoder(w).Encode(result)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

	if config.App == AppColabFold {
		a3mreader := Reader[string]{}
		base := config.Paths.ColabFold.Pdb70 + "_a3m"
		err := a3mreader.Make(base+".ffdata", base+".ffindex")
		if err != nil {
			log.Fatal(err)
		}

		r.HandleFunc("/template/{list}", func(w http.ResponseWriter, req *http.Request) {
			templates := strings.Split(mux.Vars(req)["list"], ",")
			w.Header().Set("Content-Disposition", "attachment; filename=\"templates.tar.gz\"")
			w.Header().Set("Content-Type", "application/octet-stream")
			if err := GatherTemplates(w, templates, a3mreader, config.Paths.ColabFold.PdbDivided, config.Paths.ColabFold.PdbObsolete); err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		}).Methods("GET")
	}

	r.HandleFunc("/queue", func(w http.ResponseWriter, req *http.Request) {
		type QueueResponse struct {
			Length int `json:"queued"`
		}
		length, err := jobsystem.QueueLength()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		w.Header().Set("Cache-Control", "no-cache, no-store")
		err = json.NewEncoder(w).Encode(QueueResponse{length})
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
		h = CorsCache(h, 86400)
	}

	srv := &http.Server{
		Handler: h,
		Addr:    config.Server.Address,
	}

	log.Println("MMseqs2 Webserver")
	log.Fatal(srv.ListenAndServe())
}
