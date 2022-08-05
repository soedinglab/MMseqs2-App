package main

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io/ioutil"
	"regexp"
	"sort"
	"strings"
)

type SearchJob struct {
	Size      int      `json:"size" validate:"required"`
	Database  []string `json:"database" validate:"required"`
	Mode      string   `json:"mode" validate:"required"`
	TaxFilter string   `json:"taxfilter"`
	query     string
}

func (r SearchJob) Hash() Id {
	h := sha256.New224()
	h.Write([]byte(r.query))
	h.Write([]byte(r.Mode))
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

func max(x, y int) int {
	if x > y {
		return x
	}
	return y
}

func (r SearchJob) Rank() float64 {
	return float64(r.Size * max(len(r.Database), 1))
}

func (r SearchJob) WriteFasta(path string) error {
	err := ioutil.WriteFile(path, []byte(r.query), 0644)
	if err != nil {
		return err
	}
	return nil
}

func isIn(num string, params []string) int {
	for i, param := range params {
		if num == param {
			return i
		}
	}

	return -1
}

var validTaxonFilter = regexp.MustCompile(`^[0-9]+(,!?[0-9]+)*$|^$`).MatchString

func NewSearchJobRequest(query string, dbs []string, validDbs []Params, mode string, resultPath string, email string, taxfilter string) (JobRequest, error) {
	job := SearchJob{
		max(strings.Count(query, ">"), 1),
		dbs,
		mode,
		taxfilter,
		query,
	}

	request := JobRequest{
		job.Hash(),
		StatusPending,
		JobSearch,
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
			return request, errors.New("Selected databases are not valid!")
		}
	}

	if !validTaxonFilter(taxfilter) {
		return request, errors.New("invalid taxon filter")
	}

	return request, nil
}
