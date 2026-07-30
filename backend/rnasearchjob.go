package main

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"os"
	"sort"
	"strings"
)

type RnaSearchJob struct {
	Size            int      `json:"size" validate:"required"`
	Database        []string `json:"database" validate:"required"`
	Mode            string   `json:"mode" validate:"omitempty"`
	IterativeSearch bool     `json:"iterativesearch"`
	TaxFilter       string   `json:"taxfilter"`
	query           string
}

func (r RnaSearchJob) Hash() Id {
	h := sha256.New224()
	h.Write(([]byte)(JobRnaSearch))
	h.Write([]byte(r.query))
	h.Write([]byte(r.Mode))
	if r.IterativeSearch {
		h.Write([]byte("iterative"))
	}
	if r.TaxFilter != "" {
		h.Write([]byte(r.TaxFilter))
	}

	sort.Strings(r.Database)

	for _, value := range r.Database {
		h.Write([]byte(value))
	}

	bs := h.Sum(nil)
	return Id(base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(bs))
}

func (r RnaSearchJob) Rank() float64 {
	iterationFactor := 1
	if r.IterativeSearch {
		iterationFactor = 3
	}
	return float64(r.Size * max(len(r.Database), 1) * iterationFactor)
}

func (r RnaSearchJob) WriteFasta(path string) error {
	return os.WriteFile(path, []byte(r.query), 0644)
}

func NewRnaSearchJobRequest(query string, dbs []string, validDbs []Params, mode string, resultPath string, email string, iterativeSearch bool, taxfilter string) (JobRequest, error) {
	job := RnaSearchJob{
		max(strings.Count(query, ">"), 1),
		dbs,
		mode,
		iterativeSearch,
		taxfilter,
		query,
	}

	request := JobRequest{
		job.Hash(),
		StatusPending,
		JobRnaSearch,
		job,
		email,
	}

	ids := make([]string, len(validDbs))
	for i, item := range validDbs {
		ids[i] = item.Path
	}

	for _, item := range job.Database {
		idx := isIn(item, ids)
		if idx == -1 {
			return request, errors.New("selected databases are not valid")
		}
		if !validDbs[idx].Rna {
			return request, errors.New("selected databases are not RNA databases")
		}
	}

	if !validTaxonFilter(taxfilter) {
		return request, errors.New("invalid taxon filter")
	}

	return request, nil
}
