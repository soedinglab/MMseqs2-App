package main

import (
	"log"
	"time"
	"strconv"
	"net/http"
	"encoding/json"

	"github.com/go-redis/redis"
	"github.com/satori/go.uuid"
	"github.com/gorilla/mux"

	"./controller"
)


func main() {
	const basepath = "asd2"
	const dbpath = "asd"

	client := redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "",
		DB:       0,
	})

	databases, err := controller.Databases(dbpath)
	if err != nil {
		panic(err)
	}

	r := mux.NewRouter()
	r.HandleFunc("/databases/", func(w http.ResponseWriter, req *http.Request) {
		type DatabaseResponse struct {
			Databases controller.ByOrder `json:"databases"`
		}

		err = json.NewEncoder(w).Encode(DatabaseResponse{databases})
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

	r.HandleFunc("/ticket/", func(w http.ResponseWriter, req *http.Request) {
		result, err := controller.NewTicket(client, req.Body)
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

	r.HandleFunc("/tickets/", func(w http.ResponseWriter, req *http.Request) {
		err := req.ParseForm()
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		res, err := controller.TicketsStatus(client, req.Form["tickets"])
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		err = json.NewEncoder(w).Encode(res)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")


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

		results, err := controller.Alignments(client, ticket, uint32(id), basepath)
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

		result, err := controller.Lookup(client, ticket, page, limit, basepath)
		err = json.NewEncoder(w).Encode(result)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
	}).Methods("GET")

	srv := &http.Server{
		Handler: r,
		Addr:    "127.0.0.1:3000",

		WriteTimeout: 15 * time.Second,
		ReadTimeout:  15 * time.Second,
	}

	log.Fatal(srv.ListenAndServe())
}
