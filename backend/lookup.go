package main

import (
	"os"
	"path/filepath"
	"strings"
)

type LookupResult struct {
	Id   uint32 `json:"id"`
	Name string `json:"name"`
	Set  uint32 `json:"set"`
}

type LookupResponse struct {
	Lookup      []LookupResult `json:"lookup"`
	HasNextPage bool           `json:"hasNext"`
	GroupBySet  bool           `json:"groupBySet"`
}

func Lookup(ticketId Id, page uint64, limit uint64, basepath string, shouldGroup bool) (LookupResponse, error) {
	result := filepath.Join(basepath, string(ticketId), "query.lookup")

	file, err := os.Open(result)
	if err != nil {
		return LookupResponse{}, err
	}
	defer file.Close()

	request, err := getJobRequestFromFile(filepath.Join(basepath, string(ticketId), "job.json"))
	if err != nil {
		return LookupResponse{}, err
	}

	isComplex := request.Type == JobComplexSearch && shouldGroup

	results := make([]LookupResult, 0)
	res := LookupResult{}
	parser := NewTsvParser(file, &res)

	var cnt uint64 = 0
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

	if isComplex {
		groupedResults := make(map[uint32]LookupResult)
		for _, res := range results {
			if _, exists := groupedResults[res.Set]; !exists {
				// Find the last index of '_' and slice the string
				lastIndex := strings.LastIndex(res.Name, "_")
				if lastIndex != -1 {
					res.Name = res.Name[:lastIndex]
				}

				groupedResults[res.Set] = res
			}
		}

		// Convert the map to a slice
		uniqueResults := make([]LookupResult, 0, len(groupedResults))
		for _, res := range groupedResults {
			uniqueResults = append(uniqueResults, res)
		}

		return LookupResponse{uniqueResults, hasNextPage, true}, nil
	}

	return LookupResponse{results, hasNextPage, false}, nil
}
