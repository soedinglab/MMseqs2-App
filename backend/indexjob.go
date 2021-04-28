package main

import (
	"crypto/sha256"
	"encoding/base64"
)

type IndexJob struct {
	Path string `json:"path" validate:"required"`
}

func (r IndexJob) Hash() Id {
	h := sha256.New224()
	h.Write([]byte(r.Path))

	bs := h.Sum(nil)
	return Id(base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(bs))
}

func (r IndexJob) Rank() float64 {
	return float64(0)
}

func NewIndexJobRequest(path string, email string) (JobRequest, error) {
	job := IndexJob{
		path,
	}

	request := JobRequest{
		job.Hash(),
		StatusPending,
		JobIndex,
		job,
		email,
	}

	return request, nil
}
