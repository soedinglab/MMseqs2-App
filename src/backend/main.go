package main

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"time"

	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
)

func server(jobsystem JobSystem, config ConfigRoot) {
	databaseParams, err := Databases(config.Paths.Databases)
	if err != nil {
		panic(err)
	}

	var databases []ParamsDisplay
	for _, db := range databaseParams {
		err = CheckDatabase(db, path.Join(config.Paths.Databases, db.Display.Path), config.Paths.Mmseqs)
		if err != nil {
			panic(err)
		}
		databases = append(databases, db.Display)
	}

	if len(databases) == 0 {
		panic("No search databases found!")
	}

	r := mux.NewRouter()
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

		status, err := ticket.Status()
		if err != nil || status != "COMPLETE" {
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

	c := cors.AllowAll()
	h := c.Handler(r)
	if _, exists := os.LookupEnv("MMSEQS_WEB_DEBUG"); exists {
		h = handlers.LoggingHandler(os.Stdout, h)
	}
	srv := &http.Server{
		Handler: h,
		Addr:    config.Address,

		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Println("MMseqs Webserver")
	log.Fatal(srv.ListenAndServe())
}

type JobExecutionError struct {
	internal error
}

func (e *JobExecutionError) Error() string {
	return "Execution Error: " + e.internal.Error()
}

type JobTimeoutError struct {
}

func (e *JobTimeoutError) Error() string {
	return "Timeout"
}

func RunJob(job Job, ticket *Ticket, config ConfigRoot) error {
	ticket.SetStatus("RUNNING")

	cmd := exec.Command(
		config.Paths.SearchScript,
		config.Paths.Mmseqs,
		config.Paths.Results,
		string(ticket.Id),
		config.Paths.Databases,
		strings.Join(job.Database, " "),
		job.Mode,
	)

	if _, exists := os.LookupEnv("MMSEQS_WEB_DEBUG"); exists {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}

	err := cmd.Start()
	if err != nil {
		ticket.SetStatus("ERROR")
		return &JobExecutionError{err}
	}

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	select {
	case <-time.After(1 * time.Hour):
		if err := cmd.Process.Kill(); err != nil {
			log.Printf("Failed to kill: %s\n", err)
		}
		ticket.SetStatus("ERROR")
		return &JobTimeoutError{}
	case err := <-done:
		if err != nil {
			ticket.SetStatus("ERROR")
			return &JobExecutionError{err}

		} else {
			log.Print("process done gracefully without error")
			ticket.SetStatus("COMPLETE")
			return nil
		}
	}
}

func worker(jobsystem JobSystem, config ConfigRoot) {
	log.Println("MMseqs Worker")
	log.Println("Using " + config.Mail.Transport + " Mail Transport")
	mailer := Factory(config.Mail.Transport)
	for {
		ticket, err := jobsystem.Dequeue()
		if err != nil {
			if ticket != nil {
				log.Print(err)
			}
			time.Sleep(100 * time.Millisecond)
			continue
		}

		if ticket == nil && err == nil {
			time.Sleep(100 * time.Millisecond)
			continue
		}

		jobFile := path.Join(config.Paths.Results, string(ticket.Id), "job.json")

		f, err := os.Open(jobFile)
		if err != nil {
			log.Print(err)
			ticket.SetStatus("ERROR")
			continue
		}

		var job Job
		dec := json.NewDecoder(bufio.NewReader(f))
		err = dec.Decode(&job)
		if err != nil {
			log.Print(err)
			ticket.SetStatus("ERROR")
			continue
		}

		err = RunJob(job, ticket, config)
		// Do not try sending an email, if we are using the NullTransport
		if _, ok := mailer.(NullTransport); ok {
			continue
		}

		switch err.(type) {
		case *JobExecutionError:
			if job.Email != "" {
				err := mailer.Send(Mail{
					config.Mail.Sender,
					job.Email,
					fmt.Sprintf(config.Mail.Templates.Error.Subject, ticket),
					fmt.Sprintf(config.Mail.Templates.Error.Body, ticket),
				})
				if err != nil {
					fmt.Printf("%s", err)
				}
			}
		case *JobTimeoutError:
			if job.Email != "" {
				err := mailer.Send(Mail{
					config.Mail.Sender,
					job.Email,
					fmt.Sprintf(config.Mail.Templates.Timeout.Subject, ticket),
					fmt.Sprintf(config.Mail.Templates.Timeout.Body, ticket),
				})
				if err != nil {
					fmt.Printf("%s", err)
				}
			}
		case nil:
			if job.Email != "" {
				err := mailer.Send(Mail{
					config.Mail.Sender,
					job.Email,
					fmt.Sprintf(config.Mail.Templates.Success.Subject, ticket),
					fmt.Sprintf(config.Mail.Templates.Success.Body, ticket),
				})
				if err != nil {
					fmt.Printf("%s", err)
				}
			}
		}
	}
}

func main() {
	configFile := "config.json"
	if len(os.Args) > 2 {
		configFile = os.Args[2]
	}
	config, err := ReadConfig(configFile)
	if err != nil {
		panic(err)
	}

	if len(os.Args) <= 1 {
		server(MakeRedisJobSystem(config.Redis), config)
	} else {
		switch os.Args[1] {
		case "-worker":
			worker(MakeRedisJobSystem(config.Redis), config)
		case "-server":
			server(MakeRedisJobSystem(config.Redis), config)
		case "-local":
			jobsystem := MakeLocalJobSystem()

			sigs := make(chan os.Signal, 1)
			signal.Notify(sigs, os.Interrupt, syscall.SIGTERM)
			go func() {
				<-sigs
				os.Exit(0)
			}()

			loop := make(chan bool)
			go worker(&jobsystem, config)
			go server(&jobsystem, config)
			<-loop

			encodeFile, err := os.Create(filepath.Join(config.Paths.Results, "queue.gob"))
			defer encodeFile.Close()
			if err != nil {
				panic(err)
			}
			jobsystem.Serialize(encodeFile)
		}
	}
}
