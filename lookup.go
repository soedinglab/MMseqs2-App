package main

import (
	"os"
	"path/filepath"

	"github.com/milot-mirdita/mmseqs-web-backend/tsv"
)

type LookupResult struct {
	Id   uint32 `json:"id"`
	Name string `json:"name"`
}

type LookupResponse struct {
	Lookup      []LookupResult `json:"lookup"`
	HasNextPage bool           `json:"hasNext"`
}

func Lookup(ticketId Id, page uint64, limit uint64, basepath string) (LookupResponse, error) {
	result := filepath.Join(basepath, string(ticketId), "input.lookup")

	file, err := os.Open(result)
	defer file.Close()
	if err != nil {
		return LookupResponse{}, err
	}

	var results []LookupResult
	res := LookupResult{}
	parser := tsv.NewParser(file, &res)

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

		res.Id--
		results = append(results, res)
	}

	return LookupResponse{results, hasNextPage}, nil
}
