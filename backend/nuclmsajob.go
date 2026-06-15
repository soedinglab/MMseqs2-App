package main

import (
	"crypto/sha256"
	"encoding/base64"
	"os"
	"strings"
)

type NuclMsaJob struct {
	Size  int    `json:"size" validate:"required"`
	Mode  string `json:"mode"`
	query string
}

func (r NuclMsaJob) Hash() Id {
	h := sha256.New224()
	h.Write([]byte(r.query))
	h.Write([]byte(r.Mode))
	// salt to avoid collisions with other job types that hash the same fields
	h.Write([]byte(JobNuclMsa))

	bs := h.Sum(nil)
	return Id(base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(bs))
}

func (r NuclMsaJob) Rank() float64 {
	return float64(r.Size)
}

func (r NuclMsaJob) WriteFasta(path string) error {
	return os.WriteFile(path, []byte(r.query), 0644)
}

func NewNuclMsaJobRequest(query string, mode string, resultPath string, email string) (JobRequest, error) {
	job := NuclMsaJob{
		max(strings.Count(query, ">"), 1),
		mode,
		query,
	}

	request := JobRequest{
		job.Hash(),
		StatusPending,
		JobNuclMsa,
		job,
		email,
	}

	return request, nil
}
