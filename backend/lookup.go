package main

import (
	"os"
	"path/filepath"
)

type LookupResult struct {
	Id   uint32 `json:"id"`
	Name string `json:"name"`
	Set  uint32 `json:"set"`
}

type LookupResponse struct {
	Lookup      []LookupResult `json:"lookup"`
	HasNextPage bool           `json:"hasNext"`
}

func Lookup(ticketId Id, page uint64, limit uint64, basepath string) (LookupResponse, error) {
	result := filepath.Join(basepath, string(ticketId), "tmp", "latest", "query.lookup")

	file, err := os.Open(result)
	if err != nil {
		return LookupResponse{}, err
	}
	defer file.Close()

	var results []LookupResult
	res := LookupResult{}
	parser := NewTsvParser(file, &res)

	var cnt uint64
	cnt = 0
	start := page * limit
	hasNextPage := false
	for {
		eof, err := parser.Next()
		if eof {
			break
		}
		if err != nil {
			return LookupResponse{}, err
		}

		cnt++
		if cnt < start {
			continue
		}

		if cnt >= (start + limit) {
			if eof, _ := parser.Next(); !eof {
				hasNextPage = true
			}
			break
		}

		results = append(results, res)
	}

	return LookupResponse{results, hasNextPage}, nil
}
