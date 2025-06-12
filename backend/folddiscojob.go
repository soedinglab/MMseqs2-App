package main

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"os"
	"sort"
	"strings"
)

type FoldDiscoJob struct {
	Size     int      `json:"size" validate:"required"`
	Database []string `json:"database" validate:"required"`
	// Mode      string   `json:"mode" validate:"oneof=3di tmalign 3diaa"`
	TaxFilter string `json:"taxfilter"`
	Motif     string `json:"motif"`
	query     string
}

func (r FoldDiscoJob) Hash() Id {
	h := sha256.New224()
	h.Write(([]byte)(JobFoldDisco))
	h.Write([]byte(r.query))
	h.Write([]byte(r.Motif))
	// h.Write([]byte(r.Mode))
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

func (r FoldDiscoJob) Rank() float64 {
	return float64(r.Size * max(len(r.Database), 1))
}

func (r FoldDiscoJob) WritePDB(path string) error {
	err := os.WriteFile(path, []byte(r.query), 0644)
	if err != nil {
		return err
	}
	return nil
}

func NewFoldDiscoJobRequest(query string, motif string, dbs []string, validDbs []Params, resultPath string, email string, taxfilter string) (JobRequest, error) {
	job := FoldDiscoJob{
		max(strings.Count(query, "HEADER"), 1),
		dbs,
		// mode,
		taxfilter,
		motif,
		query,
	}

	request := JobRequest{
		job.Hash(),
		StatusPending,
		JobFoldDisco,
		job,
		email,
	}

	ids := make([]string, 0)
	for _, item := range validDbs {
		if item.Motif {
			ids = append(ids, item.Path)
		}
	}

	for _, item := range job.Database {
		idx := isIn(item, ids)
		if idx == -1 {
			return request, errors.New("selected databases are not valid")
		}
	}

	if !validTaxonFilter(taxfilter) {
		return request, errors.New("invalid taxon filter")
	}

	return request, nil
}
