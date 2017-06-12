package controller

import (
	"strings"
	"path/filepath"

	"github.com/go-redis/redis"
	"github.com/satori/go.uuid"

	"../dbreader"
	"../tsv"
)

type AlignmentResult struct {
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

type AlignmentResultResponse struct {
	Alignments []AlignmentResult `json:"alignments"`
}

func Alignments(client *redis.Client, ticket uuid.UUID, entry int64, jobsbase string) (AlignmentResultResponse, error) {
	res, err := client.Get("mmseqs:status:" + ticket.String()).Result()
	if err != nil {
		return AlignmentResultResponse{}, err
	}

	if res == "COMPLETED" {
		result := filepath.Join(jobsbase, ticket.String(), "alis")

		reader := dbreader.Reader{}
		reader.Make(result, result+".index")
		defer reader.Delete()
		data := strings.NewReader(reader.Data(entry))

		var results []AlignmentResult
		res := AlignmentResult{}
		parser := tsv.NewParser(data, &res)
		for {
			eof, err := parser.Next()
			if eof {
				break
			}
			if err != nil {
				return AlignmentResultResponse{}, err
			}
			results = append(results, res)
		}

		return AlignmentResultResponse{results}, nil
	}

	return AlignmentResultResponse{}, nil
}
