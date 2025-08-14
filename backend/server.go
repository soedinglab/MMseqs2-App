package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"log"
	"math"
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

			if db.Motif {
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
				false,
				false,
				req.FormValue("index"),
				req.FormValue("search"),
				"",
				StatusPending,
				nil,
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
		var iterativesearch bool
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
			iterativesearch = req.FormValue("iterativesearch") == "true"
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
			iterativesearch = req.FormValue("iterativesearch") == "true"
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
		} else if config.App == AppFoldseek {
			modes := strings.Split(mode, "-")
			modeIdx := isIn("complex", modes)
			if modeIdx != -1 {
				modeWithoutComplex := strings.Join(append(modes[:modeIdx], modes[modeIdx+1:]...), "-")
				request, err = NewComplexSearchJobRequest(query, dbs, databases, modeWithoutComplex, config.Paths.Results, email, taxfilter)
			} else {
				request, err = NewStructureSearchJobRequest(query, dbs, databases, mode, config.Paths.Results, email, iterativesearch, taxfilter)
			}
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

	ticketFoldMasonMSAHandlerFunc := func(w http.ResponseWriter, req *http.Request) {
		var queries []string
		var fileNames []string
		var gapOpen int64
		var gapExtend int64

		if strings.HasPrefix(req.Header.Get("Content-Type"), "multipart/form-data") {
			err := req.ParseMultipartForm(int64(128 * 1024 * 1024))
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			files := req.MultipartForm.File["queries[]"]
			if len(files) == 0 {
				http.Error(w, "No files uploaded", http.StatusBadRequest)
				return
			}

			for _, fileHeader := range files {
				file, err := fileHeader.Open()
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}
				defer file.Close()

				buf := new(bytes.Buffer)
				_, err = io.Copy(buf, file)
				if err != nil {
					http.Error(w, err.Error(), http.StatusInternalServerError)
					return
				}

				query := buf.String()
				queries = append(queries, query)
			}
		} else {
			err := req.ParseForm()
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			queries = req.Form["queries[]"]

		}
		fileNames = req.Form["fileNames[]"]

		gapOpen, err = strconv.ParseInt(req.FormValue("gapOpen"), 10, 32)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		gapExtend, err = strconv.ParseInt(req.FormValue("gapExtend"), 10, 32)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		request, err := NewFoldMasonMSAJobRequest(queries, fileNames, gapOpen, gapExtend)
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

	ticketFolddiscoHandlerFunc := func(w http.ResponseWriter, req *http.Request) {
		var query string
		var motif string
		var dbs []string
		//var mode string
		var email string
		//var iterativesearch bool
		// var taxfilter string

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
			//mode = req.FormValue("mode")
			email = req.FormValue("email")
			motif = req.FormValue("motif")
			// taxfilter = req.FormValue("taxfilter")
		} else {
			err := req.ParseForm()
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			query = req.FormValue("q")
			dbs = req.Form["database[]"]
			//mode = req.FormValue("mode")
			email = req.FormValue("email")
			motif = req.FormValue("motif")
			// taxfilter = req.FormValue("taxfilter")
		}

		databases, err := Databases(config.Paths.Databases, true)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		request, err := NewFoldDiscoJobRequest(query, motif, dbs, databases /*mode,*/, config.Paths.Results, email /*, taxfilter*/)
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
		if config.Server.RateLimit.IpLookupHeader != "" {
			lmt.SetIPLookups([]string{config.Server.RateLimit.IpLookupHeader})
		}

		allowlistedCIDRs := parseCIDRs(config.Server.RateLimit.AllowList)
		if config.App == AppMMseqs2 || config.App == AppFoldseek {
			r.Handle("/ticket", ratelimitWithAllowlistHandler(allowlistedCIDRs, lmt, ticketHandlerFunc)).Methods("POST")
		}
		if config.App == AppColabFold || config.App == AppPredictProtein {
			r.Handle("/ticket/msa", ratelimitWithAllowlistHandler(allowlistedCIDRs, lmt, ticketMsaHandlerFunc)).Methods("POST")
		}
		if config.App == AppColabFold {
			r.Handle("/ticket/pair", ratelimitWithAllowlistHandler(allowlistedCIDRs, lmt, ticketPairHandlerFunc)).Methods("POST")
		}
		if config.App == AppFoldseek {
			r.Handle("/ticket/foldmason", ratelimitWithAllowlistHandler(allowlistedCIDRs, lmt, ticketFoldMasonMSAHandlerFunc)).Methods("POST")
			r.Handle("/ticket/folddisco", ratelimitWithAllowlistHandler(allowlistedCIDRs, lmt, ticketFolddiscoHandlerFunc)).Methods("POST")
		}
	} else {
		if config.App == AppMMseqs2 || config.App == AppFoldseek {
			r.HandleFunc("/ticket", ticketHandlerFunc).Methods("POST")
		}
		if config.App == AppColabFold || config.App == AppPredictProtein {
			r.HandleFunc("/ticket/msa", ticketMsaHandlerFunc).Methods("POST")
		}
		if config.App == AppColabFold {
			r.HandleFunc("/ticket/pair", ticketPairHandlerFunc).Methods("POST")
		}
		if config.App == AppFoldseek {
			r.HandleFunc("/ticket/foldmason", ticketFoldMasonMSAHandlerFunc).Methods("POST")
			r.HandleFunc("/ticket/folddisco", ticketFolddiscoHandlerFunc).Methods("POST")
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
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		if status != StatusComplete {
			http.Error(w, "Job is not complete", http.StatusBadRequest)
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

	r.HandleFunc("/result/folddisco/download/{ticket}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
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

		name := "folddisco_results_" + string(ticket.Id) + ".tar.gz"
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

	r.HandleFunc("/result/foldmason/{ticket}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		ticket, err := jobsystem.GetTicket(Id(vars["ticket"]))
		log.Println(ticket, "hello")
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		path := filepath.Join(filepath.Clean(config.Paths.Results), string(ticket.Id), "foldmason.json")

		file, err := os.Open(path)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		defer file.Close()

		w.Header().Set("Cache-Control", "public, max-age=3600")
		w.Header().Set("Content-Type", "application/json")

		_, err = io.Copy(w, file)
		if err != nil {
			http.Error(w, "Failed to send file.", http.StatusInternalServerError)
			return
		}
	}).Methods("GET")

	r.HandleFunc("/result/folddisco/{ticket}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
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

		database := req.URL.Query().Get("database")
		parId := req.URL.Query().Get("id")

		tarId := ""
		if parId != "" {
			tarId = parId
		}
		var results []FoldDiscoResult
		var motif string
		resultBase := filepath.Join(config.Paths.Results, string(ticket.Id))
		request, err := getJobRequestFromFile(filepath.Join(resultBase, "job.json"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		if tarId == "" { // If it is the result table
			switch job := request.Job.(type) {
			case FoldDiscoJob:
				databases := job.Database
				if database != "" {
					if isIn(database, job.Database) == -1 {
						http.Error(w, "Database not found", http.StatusBadRequest)
						return
					}
					databases = []string{database}
				}
				results, err = FoldDiscoAlignments(ticket.Id, databases, config.Paths.Results)
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}

				for _, res := range results {
					if res.Alignments == nil {
						continue
					}
				}
			default:
				http.Error(w, "Invalid job type", http.StatusBadRequest)
				return
			}
		} else { // If it requests a target structure
			var pdbpath string
			if strings.HasPrefix(database, "pdb100") {
				pdbpath = filepath.Join(config.Paths.Pdb100, tarId)
			} else {
				pdbpath = filepath.Join(resultBase, "pdb_"+database, tarId+".pdb")
			}

			if !fileExists(pdbpath) { // Generate pdb file with foldcomp
				idPath := filepath.Join(resultBase, "id.list")
				idlist, err := os.Create(idPath)
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				idlist.WriteString(tarId)
				err = idlist.Close()
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}

				db_prefix := strings.TrimSuffix(database, "_folddisco")
				db_foldcomp := db_prefix + "_foldcomp"
				err = execCommandSync(
					config.Verbose,
					[]string{
						config.Paths.FoldComp,
						"decompress",
						"--id-list",
						idPath,
						filepath.Join(config.Paths.Databases, db_foldcomp),
						filepath.Join(resultBase, "pdb_"+database),
						"--id-mode", "0", "--use-cache",
					},
					[]string{},
					1*time.Minute,
				)
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
				}
			}

			pdb, err := os.ReadFile(pdbpath)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			w.Header().Set("Content-Type", "application/octet-stream")
			w.Header().Set("Cache-Control", "public, max-age=3600")
			w.Write(pdb)
			return
		}

		type FoldDiscoModeResponse struct {
			// Mode    string            `json:"mode"`
			Motif   string            `json:"motif"`
			Results []FoldDiscoResult `json:"results"`
		}
		w.Header().Set("Cache-Control", "public, max-age=3600")
		err = json.NewEncoder(w).Encode(FoldDiscoModeResponse{motif, results})
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

	queryHandler := http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		ticket, err := jobsystem.GetTicket(Id(vars["ticket"]))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		var queryPath string
		switch config.App {
		case "foldseek":
			pdbPath := filepath.Join(config.Paths.Results, string(ticket.Id), "job.pdb")
			cifPath := filepath.Join(config.Paths.Results, string(ticket.Id), "job.cif")
			if fileExists(pdbPath) {
				queryPath = pdbPath
			} else if fileExists(cifPath) {
				queryPath = cifPath
			} else {
				http.Error(w, "File not found", http.StatusBadRequest)
				return
			}
		default:
			queryPath = filepath.Join(config.Paths.Results, string(ticket.Id), "job.fasta")
		}
		query, err := os.ReadFile(queryPath)
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
		id, err := strconv.ParseInt(vars["entry"], 10, 64)
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

		request, err := getJobRequestFromFile(filepath.Join(config.Paths.Results, string(ticket.Id), "job.json"))
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		database := req.URL.Query().Get("database")
		var fasta []FastaEntry
		var results []SearchResult
		var mode string
		isFoldseek := false
		switch job := request.Job.(type) {
		case SearchJob:
			mode = job.Mode
			ids := []int64{id}
			databases := job.Database
			if database != "" {
				if isIn(database, job.Database) == -1 {
					http.Error(w, "Database not found", http.StatusBadRequest)
					return
				}
				databases = []string{database}
			}
			results, err = Alignments(ticket.Id, ids, databases, config.Paths.Results)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			fasta, err = ReadQueryByIds(ticket.Id, ids, config.Paths.Results)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		case StructureSearchJob:
			mode = job.Mode
			ids := []int64{id}
			isFoldseek = true
			databases := job.Database
			if database != "" {
				if isIn(database, job.Database) == -1 {
					http.Error(w, "Database not found", http.StatusBadRequest)
					return
				}
				databases = []string{database}
			}
			results, err = FSAlignments(ticket.Id, ids, databases, config.Paths.Results)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			fasta, err = ReadQueryByIds(ticket.Id, ids, config.Paths.Results)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		case ComplexSearchJob:
			mode = job.Mode
			result, err := Lookup(ticket.Id, 0, math.MaxInt32, config.Paths.Results, false)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			keys := make([]uint32, 0)
			for _, lookup := range result.Lookup {
				if lookup.Set == uint32(id) {
					keys = append(keys, uint32(lookup.Id))
				}
			}
			isFoldseek = true
			databases := job.Database
			if database != "" {
				if isIn(database, job.Database) == -1 {
					http.Error(w, "Database not found", http.StatusBadRequest)
					return
				}
				databases = []string{database}
			}
			results, err = ComplexAlignments(ticket.Id, keys, databases, config.Paths.Results)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			fasta, err = ReadQueryByKeys(ticket.Id, keys, config.Paths.Results)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
		default:
			http.Error(w, "Invalid job type", http.StatusBadRequest)
			return
		}

		parIndex := req.URL.Query().Get("index")
		format := req.URL.Query().Get("format")
		if isFoldseek && format == "brief" {
			resIndex := -1
			if parIndex != "" {
				tmp, err := strconv.ParseInt(parIndex, 10, 32)
				if err != nil {
					http.Error(w, err.Error(), http.StatusBadRequest)
					return
				}
				resIndex = int(tmp)
			}
			for _, res := range results {
				if res.Alignments == nil {
					continue
				}
				cnt := 0
				switch conv := res.Alignments.(type) {
				case [][]FoldseekAlignmentEntry:
					for _, inner := range conv {
						for i := range inner {
							if cnt == resIndex {
								w.Header().Set("Cache-Control", "public, max-age=3600")
								err = json.NewEncoder(w).Encode([]FoldseekAlignmentEntry{inner[i]})
								if err != nil {
									http.Error(w, err.Error(), http.StatusBadRequest)
								}
								return
							}
							if resIndex == -1 {
								idx := strconv.Itoa(cnt)
								inner[i].MarshalFormat = MarshalTargetNumeric
								inner[i].TargetCa = idx
								inner[i].TargetSeq = idx
							}
							cnt++
						}
					}
				case [][]ComplexAlignmentEntry:
					if resIndex == -1 {
						for _, inner := range conv {
							for i := range inner {
								inner[i].MarshalFormat = MarshalTargetNumeric
								inner[i].TargetCa = strconv.Itoa(inner[i].ComplexAssignId)
								inner[i].TargetSeq = strconv.Itoa(inner[i].ComplexAssignId)
							}
						}
					} else {
						w.Header().Set("Cache-Control", "public, max-age=3600")
						w.Write([]byte("["))
						skippedFirst := false
						for _, inner := range conv {
							for j := range inner {
								if resIndex == inner[j].ComplexAssignId {
									if !skippedFirst {
										skippedFirst = true
									} else {
										w.Write([]byte(","))
									}
									err = json.NewEncoder(w).Encode(inner[j])
									if err != nil {
										http.Error(w, err.Error(), http.StatusBadRequest)
										return
									}
								}
							}
						}
						w.Write([]byte("]"))
						return
					}
				default:
					continue
				}
			}
			if resIndex != -1 {
				http.Error(w, "Not found", http.StatusBadRequest)
				return
			}
		}

		type AlignmentModeResponse struct {
			Queries []FastaEntry   `json:"queries"`
			Mode    string         `json:"mode"`
			Results []SearchResult `json:"results"`
		}
		w.Header().Set("Cache-Control", "public, max-age=3600")
		err = json.NewEncoder(w).Encode(AlignmentModeResponse{fasta, mode, results})
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
		result, err := Lookup(ticket.Id, page, limit, config.Paths.Results, true)
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

	if config.App == AppColabFold && config.Paths.ColabFold.Pdb70 != "" {
		a3mreader := Reader[string]{}
		a3mbase := config.Paths.ColabFold.Pdb70 + "_a3m"
		err := a3mreader.Make(a3mbase+".ffdata", a3mbase+".ffindex")
		if err != nil {
			log.Fatal(err)
		}

		var hhmreader *Reader[string] = nil
		hhmbase := config.Paths.ColabFold.Pdb70 + "_hhm"
		if fileExists(hhmbase+".ffdata") && fileExists(hhmbase+".ffindex") {
			hhmreader = &Reader[string]{}
			err = hhmreader.Make(hhmbase+".ffdata", hhmbase+".ffindex")
			if err != nil {
				log.Fatal(err)
			}
		}

		r.HandleFunc("/template/{list}", func(w http.ResponseWriter, req *http.Request) {
			templates := strings.Split(mux.Vars(req)["list"], ",")
			w.Header().Set("Content-Disposition", "attachment; filename=\"templates.tar.gz\"")
			w.Header().Set("Content-Type", "application/octet-stream")
			if err := GatherTemplates(w, templates, a3mreader, hhmreader, config.Paths.ColabFold.PdbDivided, config.Paths.ColabFold.PdbObsolete); err != nil {
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
