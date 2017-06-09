package controller

import (
	"io"

	"github.com/satori/go.uuid"
	"github.com/go-redis/redis"

	"../decoder"
)

type status string
type TicketResponse struct {
	Ticket uuid.UUID `json:"ticket"`
	Status status  `json:"status"`
}

func NewTicket(client *redis.Client, reader io.Reader) (TicketResponse, error) {
	type TicketRequest struct {
		Query    string `json:"q",valid:"alphanum,required"`
		Database []string `json:"required"`
		Mode     string `json:"mode",valid:"in(accept,summary),required"`
		Email    string `json:"email",valid:"email,optional"`
	}

	var request TicketRequest
	if err := decoder.DecodeAndValidate(reader, &request); err != nil {
		return TicketResponse{}, err
	}

	ticket := uuid.NewV4()

	_, err := client.ZAdd("mmseqs:pending", redis.Z{1, ticket.String() }).Result()
	if err != nil {
		return TicketResponse{}, err
	}

	_, err = client.Set("mmseqs:status:"+ticket.String(), "PENDING", 0).Result()
	if err != nil {
		return TicketResponse{}, err
	}

	return TicketResponse{ticket, "PENDING"}, nil
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
	var res []string
	for _, value := range tickets {
		parsedUuid, err := uuid.FromString(value)
		if err != nil {
			return nil, err
		}
		res = append(res, parsedUuid.String())
	}
	r, err := client.MGet([]string(res)...).Result()
	if err != nil {
		return nil, err
	}

	var result []TicketResponse
	for i, item := range r {
		value, ok := item.(status)
		if !ok {
			return nil, err
		}

		ticket, err := uuid.FromString(res[i])
		if err != nil {
			return nil, err
		}
		result = append(result, TicketResponse{ticket, value })
	}

	return result, nil
}