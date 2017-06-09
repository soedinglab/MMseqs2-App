package controller

import (
	"os"
	"fmt"
	"github.com/satori/go.uuid"
	"github.com/go-redis/redis"

	"../tsv"
)

type LookupResult struct {
	Id   uint32 `json:"id"`
	Name string  `json:"name"`
}

type LookupResponse struct {
	Lookup []LookupResult `json:"lookup"`
}

func Lookup(client *redis.Client, ticket uuid.UUID, page uint64, limit uint64, basepath string) (LookupResponse, error) {
	res, err := client.Get("mmseqs:status:" + ticket.String()).Result()
	if err != nil {
		return LookupResponse{}, err
	}

	if res == "COMPLETED" {
		result := fmt.Sprintf("%s/%s/input.lookup", basepath, ticket)

		file, err := os.Open(result)
		if err != nil {
			return LookupResponse{}, err
		}
		var results []LookupResult
		res := LookupResult{}
		parser := tsv.NewParser(file, &res)
		for {
			eof, err := parser.Next()
			if eof {
				break
			}
			if err != nil {
				return LookupResponse{}, err
			}
			results = append(results, res)
		}

		return LookupResponse{results[page*limit:page*limit+limit]}, nil
	}
	return LookupResponse{}, nil
}
