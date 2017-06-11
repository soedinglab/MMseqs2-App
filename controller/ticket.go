package controller

import (
	"io"

	"github.com/asaskevich/govalidator"
	"github.com/go-redis/redis"
	"github.com/satori/go.uuid"

	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"

	"../decoder"
)

type TicketRequest struct {
	Query    string   `json:"q",valid:"alphanum,required"`
	Database []string `json:"database",valid:"required"`
	Mode     string   `json:"mode",valid:"in(accept,summary),required"`
	Email    string   `json:"email",valid:"email,optional"`
}

func rankRequest(request TicketRequest) float64 {
	return 1.0
}

type status string
type TicketResponse struct {
	Ticket uuid.UUID `json:"ticket"`
	Status status    `json:"status"`
}

type Job struct {
	Database []string `json:"database"`
	Mode     string   `json:"mode"`
	Email    string   `json:"email"`
}

func NewTicket(client *redis.Client, reader io.Reader, validDatabaseNames []string, jobsbase string) (TicketResponse, error) {
	var request TicketRequest
	if err := decoder.DecodeAndValidate(reader, &request); err != nil {
		return TicketResponse{}, err
	}

	for _, item := range request.Database {
		if !govalidator.IsIn(item, validDatabaseNames...) {
			return TicketResponse{}, errors.New("Selected databases are not valid!")
		}
	}

	s := "PENDING"
	ticket := uuid.NewV4()

	err := client.Watch(func(tx *redis.Tx) error {
		_, err := tx.ZAdd("mmseqs:pending", redis.Z{rankRequest(request), ticket.String()}).Result()
		if err != nil {
			return err
		}

		workdir := filepath.Join(jobsbase, ticket.String())

		err = os.Mkdir(workdir, 0755)
		if err != nil {
			s = "ERROR"
		}

		file, err := os.Create(filepath.Join(workdir, "job.json"))
		defer file.Close()
		if err != nil {
			s = "ERROR"
		} else {
			err = json.NewEncoder(file).Encode(Job{request.Database, request.Mode, request.Email})
			if err != nil {
				s = "ERROR"
			}

			err = ioutil.WriteFile(filepath.Join(workdir, "job.fasta"), []byte(request.Query), 0644)
			if err != nil {
				s = "ERROR"
			}
		}

		_, err = tx.Set("mmseqs:status:"+ticket.String(), s, 0).Result()
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return TicketResponse{}, err
	}

	return TicketResponse{ticket, status(s)}, nil
}

func TicketStatus(client *redis.Client, ticket string) (TicketResponse, error) {
	u, err := uuid.FromString(ticket)
	if err != nil {
		return TicketResponse{}, err
	}

	res, err := client.Get("mmseqs:status:" + u.String()).Result()
	if err != nil {
		return TicketResponse{}, err
	}

	return TicketResponse{u, status(res)}, nil
}

func TicketsStatus(client *redis.Client, tickets []string) ([]TicketResponse, error) {
	var res []uuid.UUID
	var queries []string
	for _, value := range tickets {
		parsedUuid, err := uuid.FromString(value)
		if err != nil {
			return nil, err
		}
		res = append(res, parsedUuid)
		queries = append(queries, "mmseqs:status:"+parsedUuid.String())
	}
	r, err := client.MGet(queries...).Result()
	if err != nil {
		return nil, err
	}

	var result []TicketResponse
	for i, item := range r {
		var value string
		switch vv := item.(type) {
		case []byte:
			value = string(vv)
		default:
			value = fmt.Sprint(vv)
		}
		result = append(result, TicketResponse{res[i], status(value)})
	}

	return result, nil
}
