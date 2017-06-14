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
	Alignments map[string][]AlignmentEntry `json:"alignments"`
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
		matches, err := filepath.Glob(filepath.Clean(filepath.Join(base, "alis")) + "_*.index")
		if err != nil {
			return AlignmentResponse{}, err
		}

		res := make(map[string][]AlignmentEntry, len(matches))
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
			res[strings.TrimPrefix(base, "alis_")] = results
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
