package main

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/go-redis/redis"
	"github.com/gorilla/mux"
	"github.com/rs/cors"
	"github.com/satori/go.uuid"
	"github.com/spf13/viper"

	"fmt"
	"os"
	"path"
	"path/filepath"

	"./controller"
	"os/exec"
	"strings"
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

	viper.SetDefault("RedisNetwork", "tcp")
	viper.SetDefault("RedisAddr", "localhost:6379")
	viper.SetDefault("RedisPassword", "")
	viper.SetDefault("RedisDB", 0)

	viper.SetDefault("ServerAddr", "127.0.0.1:3000")

	err = viper.ReadInConfig()
	_, notFoundError := err.(viper.ConfigFileNotFoundError)
	if err != nil && !notFoundError {
		panic(fmt.Errorf("Fatal error for config file: %s\n", err))
	}

	existsOrPanic(viper.GetString("Databases"))
	existsOrPanic(viper.GetString("JobsBase"))
	existsOrPanic(viper.GetString("SearchPipeline"))
}

func server(client *redis.Client) {
	databases, err := controller.Databases(viper.GetString("Databases"))
	if err != nil {
		panic(err)
	}

	if len(databases) == 0 {
		panic("No search databases found!")
	}

	r := mux.NewRouter()
	r.HandleFunc("/databases", func(w http.ResponseWriter, req *http.Request) {
		type DatabaseResponse struct {
			Databases controller.ByOrder `json:"databases"`
		}

		err = json.NewEncoder(w).Encode(DatabaseResponse{databases})
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

	r.HandleFunc("/ticket", func(w http.ResponseWriter, req *http.Request) {
		err := req.ParseForm()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		dbs := make([]int, len(req.Form["db"]))
		for i, val := range req.Form["db"] {
			res, err := strconv.ParseInt(val, 10, 64)
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}

			dbs[i] = int(res)
		}
		request := controller.TicketRequest{
			req.FormValue("q"),
			dbs,
			req.FormValue("mode"),
			req.FormValue("email"),
		}

		result, err := controller.NewTicket(client, request, databases, viper.GetString("JobsBase"))
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
		ticket, err := controller.TicketStatus(client, mux.Vars(req)["ticket"])
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

		res, err := controller.TicketsStatus(client, req.Form["tickets[]"])
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
		ticket, err := uuid.FromString(vars["ticket"])
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		id, err := strconv.ParseUint(vars["entry"], 10, 32)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		results, err := controller.Alignments(client, ticket, uint32(id), viper.GetString("JobsBase"))
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
		ticket, err := uuid.FromString(vars["ticket"])
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

		result, err := controller.Lookup(client, ticket, page, limit, viper.GetString("JobsBase"))
		err = json.NewEncoder(w).Encode(result)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

	c := cors.AllowAll()
	srv := &http.Server{
		Handler: c.Handler(r),
		Addr:    viper.GetString("ServerAddr"),

		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Fatal(srv.ListenAndServe())
}

func worker(client *redis.Client) {
	Zpop := redis.NewScript(`
    local r = redis.call('ZRANGE', KEYS[1], 0, 0)
    if r ~= nil then
        r = r[1]
        redis.call('ZREM', KEYS[1], r)
    end
    return r
`)

	for {
		pop, err := Zpop.Run(client, []string{"mmseqs:pending"}).Result()
		if err != nil {
			log.Print(err)
			continue
		}

		var value string
		switch vv := pop.(type) {
		case nil:
			continue
		case []byte:
			value = string(vv)
		default:
			value = fmt.Sprint(vv)
		}

		ticket, err := uuid.FromString(value)
		if err != nil {
			log.Print(err)
			continue
		}

		client.Set("mmseqs:status:"+ticket.String(), "RUNNING", 0)

		jobFile := path.Join(viper.GetString("JobsBase"), ticket.String(), "job.json")

		file, err := os.Open(jobFile)
		if err != nil {
			client.Set("mmseqs:status:"+ticket.String(), "ERROR", 0)
			continue
		}

		var job controller.Job
		dec := json.NewDecoder(file)
		err = dec.Decode(&job)
		if err != nil {
			client.Set("mmseqs:status:"+ticket.String(), "ERROR", 0)
			continue
		}

		client.Set("mmseqs:status:"+ticket.String(), "COMPLETED", 0)

		cmd := exec.Command(
			viper.GetString("SearchPipeline"),
			viper.GetString("JobsBase"),
			ticket.String(),
			viper.GetString("Databases"),
			strings.Join(job.Database, " "),
			job.Mode,
		)

		done := make(chan error, 1)
		go func() {
			done <- cmd.Wait()
		}()

		select {
		case <-time.After(1 * time.Hour):
			if err := cmd.Process.Kill(); err != nil {
				log.Printf("Failed to kill: %s\n", err)
			}
			client.Set("mmseqs:status:"+ticket.String(), "ERROR", 0)
		case err := <-done:
			if err != nil {
				client.Set("mmseqs:status:"+ticket.String(), "ERROR", 0)

			} else {
				log.Print("process done gracefully without error")
				client.Set("mmseqs:status:"+ticket.String(), "COMPLETED", 0)

			}
		}
	}
}

func main() {
	setupConfig()

	client := redis.NewClient(&redis.Options{
		Network:  viper.GetString("RedisNetwork"),
		Addr:     viper.GetString("RedisAddr"),
		Password: viper.GetString("RedisPassword"),
		DB:       viper.GetInt("RedisDB"),
	})

	if len(os.Args) > 1 && os.Args[1] == "-worker" {
		worker(client)
	} else {
		server(client)
	}
}
