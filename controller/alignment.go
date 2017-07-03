package controller

import (
	"path/filepath"
	"strings"

	"github.com/go-redis/redis"

	"github.com/milot-mirdita/mmseqs-web-backend/dbreader"
	"github.com/milot-mirdita/mmseqs-web-backend/tsv"
)

type AlignmentEntry struct {
	Query         string  `json:"query"`
	Target        string  `json:"target"`
	SeqId         float32 `json:"seqId"`
	AlnLength     int     `json:"alnLength"`
	Missmatches   int     `json:"missmatches"`
	Gapsopened    int     `json:"gapsopened"`
	QueryStartPos int     `json:"qStartPos"`
	QueryEndPos   int     `json:"qEndPos"`
	DbStartPos    int     `json:"dbStartPos"`
	DbEndPos      int     `json:"dbEndPos"`
	Eval          float64 `json:"eval"`
	Score         int     `json:"score"`
	QueryLength   int     `json:"qLen"`
	DbLength      int     `json:"dbLen"`
}

type FastaEntry struct {
	Header   string `json:"header"`
	Sequence string `json:"sequence"`
}

type SearchResult struct {
	Database   string           `json:"db"`
	Alignments []AlignmentEntry `json:"alignments"`
}

type AlignmentResponse struct {
	Query   FastaEntry     `json:"query"`
	Results []SearchResult `json:"results"`
}

func dbpaths(path string) (string, string) {
	return path, path + ".index"
}

func Alignments(client *redis.Client, ticket Ticket, entry int64, jobsbase string) (AlignmentResponse, error) {
	res, err := client.Get("mmseqs:status:" + string(ticket)).Result()
	if err != nil {
		return AlignmentResponse{}, err
	}

	if res == "COMPLETED" {
		base := filepath.Join(jobsbase, string(ticket))
		matches, err := filepath.Glob(filepath.Clean(filepath.Join(base, "result")) + "_*.index")
		if err != nil {
			return AlignmentResponse{}, err
		}

		var res []SearchResult
		for _, item := range matches {
			name := strings.TrimSuffix(item, ".index")
			reader := dbreader.Reader{}
			reader.Make(dbpaths(name))
			data := strings.NewReader(reader.Data(entry))

			var results []AlignmentEntry
			r := AlignmentEntry{}
			parser := tsv.NewParser(data, &r)
			for {
				eof, err := parser.Next()
				if eof {
					break
				}
				if err != nil {
					return AlignmentResponse{}, err
				}
				results = append(results, r)
			}

			base := filepath.Base(name)
			res = append(res, SearchResult{strings.TrimPrefix(base, "alis_"), results})
			reader.Delete()
		}

		reader := dbreader.Reader{}
		reader.Make(dbpaths(filepath.Join(base, "input")))
		sequence := reader.Data(entry)
		reader.Delete()

		reader = dbreader.Reader{}
		reader.Make(dbpaths(filepath.Join(base, "input_h")))
		header := reader.Data(entry)
		reader.Delete()

		return AlignmentResponse{FastaEntry{header, sequence}, res}, nil
	}

	return AlignmentResponse{}, nil
}
