package main

import (
	"crypto/sha256"
	"encoding/base64"
	"os"
	"strings"
)

type PairJob struct {
	Size  int    `json:"size" validate:"required"`
	Mode  string `json:"mode"`
	query string
}

func (r PairJob) Hash() Id {
	h := sha256.New224()
	h.Write([]byte(r.query))
	h.Write([]byte(r.Mode))

	bs := h.Sum(nil)
	return Id(base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(bs))
}

func (r PairJob) Rank() float64 {
	return float64(r.Size)
}

func (r PairJob) WriteFasta(path string) error {
	err := os.WriteFile(path, []byte(r.query), 0644)
	if err != nil {
		return err
	}
	return nil
}

func NewPairJobRequest(query string, mode string, mail string) (JobRequest, error) {
	job := PairJob{
		max(strings.Count(query, ">"), 1),
		mode,
		query,
	}

	request := JobRequest{
		job.Hash(),
		StatusPending,
		JobPair,
		job,
		mail,
	}

	return request, nil
}
