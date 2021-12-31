package main

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io/ioutil"
	"sort"
	"strings"
)

type StructureSearchJob struct {
	Size     int      `json:"size" validate:"required"`
	Database []string `json:"database" validate:"required"`
	Mode     string   `json:"mode" validate:"oneof=3di tmalign 3diaa"`
	query    string
}

func (r StructureSearchJob) Hash() Id {
	h := sha256.New224()
	h.Write([]byte(r.query))
	h.Write([]byte(r.Mode))

	sort.Strings(r.Database)

	for _, value := range r.Database {
		h.Write([]byte(value))
	}

	bs := h.Sum(nil)
	return Id(base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(bs))
}

func (r StructureSearchJob) Rank() float64 {
	return float64(r.Size * max(len(r.Database), 1))
}

func (r StructureSearchJob) WritePDB(path string) error {
	err := ioutil.WriteFile(path, []byte(r.query), 0644)
	if err != nil {
		return err
	}
	return nil
}

func NewStructureSearchJobRequest(query string, dbs []string, validDbs []Params, mode string, resultPath string, email string) (JobRequest, error) {
	job := StructureSearchJob{
		max(strings.Count(query, "HEADER"), 1),
		dbs,
		mode,
		query,
	}

	request := JobRequest{
		job.Hash(),
		StatusPending,
		JobStructureSearch,
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

	return request, nil
}
