package controller

import (
	"strings"
	"path/filepath"

	"github.com/go-redis/redis"
	"github.com/satori/go.uuid"

	"../dbreader"
	"../tsv"
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
}

type FastaEntry struct {
	Header string `json:"header"`
	Sequence string `json:"sequence"`
}

type AlignmentResponse struct {
	Query FastaEntry `json:"query"`
	Alignments []AlignmentEntry `json:"alignments"`
}

func dbpaths(path string) (string, string) {
	return path, path + ".index"
}

func Alignments(client *redis.Client, ticket uuid.UUID, entry int64, jobsbase string) (AlignmentResponse, error) {
	res, err := client.Get("mmseqs:status:" + ticket.String()).Result()
	if err != nil {
		return AlignmentResponse{}, err
	}

	if res == "COMPLETED" {

		base := filepath.Join(jobsbase, ticket.String())
		reader := dbreader.Reader{}
		reader.Make(dbpaths(filepath.Join(base, "alis")))
		data := strings.NewReader(reader.Data(entry))
		reader.Delete()

		reader = dbreader.Reader{}
		reader.Make(dbpaths(filepath.Join(base, "input")))
		sequence := reader.Data(entry)
		reader.Delete()

		reader = dbreader.Reader{}
		reader.Make(dbpaths(filepath.Join(base, "input_h")))
		header := reader.Data(entry)
		reader.Delete()

		var results []AlignmentEntry
		res := AlignmentEntry{}
		parser := tsv.NewParser(data, &res)
		for {
			eof, err := parser.Next()
			if eof {
				break
			}
			if err != nil {
				return AlignmentResponse{}, err
			}
			results = append(results, res)
		}

		return AlignmentResponse{FastaEntry{header, sequence}, results}, nil
	}

	return AlignmentResponse{}, nil
}
