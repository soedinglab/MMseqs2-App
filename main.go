package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/alecthomas/units"
	"github.com/go-redis/redis"
	"github.com/gorilla/handlers"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"github.com/spf13/viper"

	"bufio"
	"github.com/milot-mirdita/mmseqs-web-backend/mail"
	"gopkg.in/oleiade/lane.v1"
)

func existsOrPanic(path string) {
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			panic(fmt.Errorf("Path %s does not exist!", path))
		} else {
			panic(fmt.Errorf("Path %s returned error: %s", path, err))
		}
	}
}

func setupConfig() {
	viper.SetConfigName("config")
	viper.AddConfigPath("/etc/mmseqs-web/")
	viper.AddConfigPath("$HOME/.mmseqs-web")
	viper.AddConfigPath(".")

	ex, err := os.Executable()
	if err != nil {
		panic(err)
	}

	basepath := path.Dir(ex)
	viper.SetDefault("Databases", filepath.Join(basepath, "databases"))
	viper.SetDefault("JobsBase", filepath.Join(basepath, "jobs"))
	viper.SetDefault("SearchPipeline", filepath.Join(basepath, "run_job.sh"))
	viper.SetDefault("Mmseqs", filepath.Join(basepath, "mmseqs"))

	viper.SetDefault("RedisNetwork", "tcp")
	viper.SetDefault("RedisAddr", "localhost:6379")
	viper.SetDefault("RedisPassword", "")
	viper.SetDefault("RedisDB", 0)

	viper.SetDefault("ServerAddr", "127.0.0.1:3000")

	viper.SetDefault("MailType", "Null")

	viper.SetDefault("MailErrorSubject", "Error -- %s")
	viper.SetDefault("MailErrorTemplate", "%s")
	viper.SetDefault("MailTimeoutSubject", "Timeout -- %s")
	viper.SetDefault("MailTimeoutTemplate", "%s")
	viper.SetDefault("MailSuccessSubject", "Done -- %s")
	viper.SetDefault("MailSuccessTemplate", "%s")

	err = viper.ReadInConfig()
	_, notFoundError := err.(viper.ConfigFileNotFoundError)
	if err != nil && !notFoundError {
		panic(fmt.Errorf("Fatal error for config file: %s\n", err))
	}

	existsOrPanic(viper.GetString("Databases"))
	existsOrPanic(viper.GetString("JobsBase"))
	existsOrPanic(viper.GetString("SearchPipeline"))
}

func server(jobsystem JobSystem) {
	databases, err := Databases(viper.GetString("Databases"))
	if err != nil {
		panic(err)
	}

	if len(databases) == 0 {
		panic("No search databases found!")
	}

	r := mux.NewRouter()
	r.HandleFunc("/databases", func(w http.ResponseWriter, req *http.Request) {
		type DatabaseResponse struct {
			Databases ByOrder `json:"databases"`
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
			err := req.ParseMultipartForm(int64(128 * units.Mebibyte))
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

		result, err := jobsystem.NewJob(request, databases, viper.GetString("JobsBase"))
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

		results, err := Alignments(ticket, int64(id), viper.GetString("JobsBase"))
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

		result, err := Lookup(ticket.Id, page, limit, viper.GetString("JobsBase"))
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
		Addr:    viper.GetString("ServerAddr"),

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

func RunJob(job Job, ticket Ticket) error {
	ticket.SetStatus("RUNNING")

	cmd := exec.Command(
		viper.GetString("SearchPipeline"),
		viper.GetString("Mmseqs"),
		viper.GetString("JobsBase"),
		string(ticket.Id),
		viper.GetString("Databases"),
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

func worker(jobsystem JobSystem) {
	log.Println("MMseqs Worker")
	log.Println("Using " + viper.GetString("MailType") + " Mail Transport")
	mailer := mail.Factory(viper.GetString("MailType"))
	for {
		ticket, err := jobsystem.Dequeue()
		if err != nil {
			if ticket != nil {
				log.Print(err)
			}
			time.Sleep(100 * time.Millisecond)
			continue
		}

		jobFile := path.Join(viper.GetString("JobsBase"), string(ticket.Id), "job.json")

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

		err = RunJob(job, *ticket)
		// Do not try sending an email, if we are using the NullTransport
		if _, ok := mailer.(mail.NullTransport); ok {
			continue
		}
		switch err.(type) {
		case *JobExecutionError:
			if job.Email != "" {
				err := mailer.Send(mail.Mail{
					viper.GetString("MailSender"),
					job.Email,
					fmt.Sprintf(viper.GetString("MailErrorSubject"), ticket),
					fmt.Sprintf(viper.GetString("MailErrorTemplate"), ticket),
				})
				if err != nil {
					fmt.Printf("%s", err)
				}
			}
		case *JobTimeoutError:
			if job.Email != "" {
				err := mailer.Send(mail.Mail{
					viper.GetString("MailSender"),
					job.Email,
					fmt.Sprintf(viper.GetString("MailTimeoutSubject"), ticket),
					fmt.Sprintf(viper.GetString("MailTimeoutTemplate"), ticket),
				})
				if err != nil {
					fmt.Printf("%s", err)
				}
			}
		case nil:
			if job.Email != "" {
				err := mailer.Send(mail.Mail{
					viper.GetString("MailSender"),
					job.Email,
					fmt.Sprintf(viper.GetString("MailSuccessSubject"), ticket),
					fmt.Sprintf(viper.GetString("MailSuccessTemplate"), ticket),
				})
				if err != nil {
					fmt.Printf("%s", err)
				}
			}
		}
	}
}

func MakeRedisJobSystem() *RedisJobSystem {
	return &RedisJobSystem{redis.NewClient(&redis.Options{
		Network:  viper.GetString("RedisNetwork"),
		Addr:     viper.GetString("RedisAddr"),
		Password: viper.GetString("RedisPassword"),
		DB:       viper.GetInt("RedisDB"),
	})}
}

func main() {
	setupConfig()

	if len(os.Args) <= 1 {
		server(MakeRedisJobSystem())
	} else {
		switch os.Args[1] {
		case "-worker":
			worker(MakeRedisJobSystem())
		case "-server":
			server(MakeRedisJobSystem())
		case "-local":
			jobsystem := LocalJobSystem{}
			jobsystem.Queue = lane.NewPQueue(lane.MINPQ)

			loop := make(chan bool)
			go worker(&jobsystem)
			go server(&jobsystem)
			<-loop
		}
	}
}
