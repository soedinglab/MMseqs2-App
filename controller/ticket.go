package controller

import (
	"github.com/go-redis/redis"

	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

type TicketRequest struct {
	Query    string   `json:"q",valid:"alphanum,required"`
	Database []string `json:"database",valid:"required"`
	Mode     string   `json:"mode",valid:"in(accept,summary),required"`
	Email    string   `json:"email",valid:"email,optional"`
}

func (r TicketRequest) Hash() string {
	h := sha256.New224()
	h.Write([]byte(r.Query))
	h.Write([]byte(r.Mode))

	sort.Strings(r.Database)

	for _, value := range r.Database {
		h.Write([]byte(value))
	}

	bs := h.Sum(nil)
	return base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(bs)
}

func max(x, y int) int {
	if x > y {
		return x
	}
	return y
}

func (r TicketRequest) Rank() float64 {
	return float64(max(strings.Count(r.Query, ">"), 1) * max(len(r.Database), 1))
}

type Ticket string
type Status string
type TicketResponse struct {
	Ticket Ticket `json:"ticket"`
	Status Status `json:"status"`
}

type Job struct {
	Database []string `json:"database"`
	Mode     string   `json:"mode"`
	Email    string   `json:"email"`
}

func IsIn(num string, params []string) int {
	for i, param := range params {
		if num == param {
			return i
		}
	}

	return -1
}

type InvalidTicket struct {
}

func (e *InvalidTicket) Error() string {
	return "Ticket is not valid!"
}

var ValidTicket = regexp.MustCompile(`^[A-Za-z0-9-_=]{38}$`).MatchString

func NewTicket(client *redis.Client, request TicketRequest, databases []ParamsDisplay, jobsbase string) (TicketResponse, error) {
	ids := make([]string, len(databases))
	for i, item := range databases {
		ids[i] = item.Path
	}

	paths := make([]string, len(request.Database))
	for i, item := range request.Database {
		idx := IsIn(item, ids)
		if idx == -1 {
			return TicketResponse{}, errors.New("Selected databases are not valid!")
		} else {
			paths[i] = databases[idx].Path
		}
	}

	s := "PENDING"
	ticket := request.Hash()

	res, err := client.Get("mmseqs:status:" + ticket).Result()
	if err == nil && res == "COMPLETED" {
		return TicketResponse{Ticket(ticket), Status(s)}, nil
	}

	err = client.Watch(func(tx *redis.Tx) error {
		_, err := tx.ZAdd("mmseqs:pending", redis.Z{request.Rank(), ticket}).Result()
		if err != nil {
			return err
		}

		workdir := filepath.Join(jobsbase, ticket)

		err = os.Mkdir(workdir, 0755)
		if err != nil {
			s = "ERROR"
		}

		file, err := os.Create(filepath.Join(workdir, "job.json"))
		defer file.Close()
		if err != nil {
			s = "ERROR"
		} else {
			err = json.NewEncoder(file).Encode(Job{paths, request.Mode, request.Email})
			if err != nil {
				s = "ERROR"
			}

			err = ioutil.WriteFile(filepath.Join(workdir, "job.fasta"), []byte(request.Query), 0644)
			if err != nil {
				s = "ERROR"
			}
		}

		_, err = tx.Set("mmseqs:status:"+ticket, s, 0).Result()
		if err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return TicketResponse{}, err
	}

	return TicketResponse{Ticket(ticket), Status(s)}, nil
}

func TicketStatus(client *redis.Client, ticket string) (TicketResponse, error) {
	if !ValidTicket(ticket) {
		return TicketResponse{}, &InvalidTicket{}
	}

	res, err := client.Get("mmseqs:status:" + ticket).Result()
	if err != nil {
		if err == redis.Nil {
			return TicketResponse{Ticket(ticket), Status("UNKNOWN")}, nil
		}
		return TicketResponse{}, err
	}

	return TicketResponse{Ticket(ticket), Status(res)}, nil
}

func TicketsStatus(client *redis.Client, tickets []string) ([]TicketResponse, error) {
	if len(tickets) == 0 {
		return make([]TicketResponse, 0), nil
	}

	var queries []string
	for _, value := range tickets {
		if !ValidTicket(value) {
			return nil, &InvalidTicket{}
		}
		queries = append(queries, "mmseqs:status:"+value)
	}
	r, err := client.MGet(queries...).Result()
	if err != nil {
		return nil, err
	}

	var result []TicketResponse
	for i, item := range r {
		var value string
		switch vv := item.(type) {
		case nil:
			value = "UNKNOWN"
		case []byte:
			value = string(vv)
		default:
			value = fmt.Sprint(vv)
		}
		result = append(result, TicketResponse{Ticket(tickets[i]), Status(value)})
	}

	return result, nil
}
