package main

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type SearchJob struct {
	Size     int      `json:"size" valid:"required"`
	Database []string `json:"database" valid:"required"`
	Mode     string   `json:"mode" valid:"required"`
	query    string
}

func (r SearchJob) Hash() Id {
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

func max(x, y int) int {
	if x > y {
		return x
	}
	return y
}

func (r SearchJob) Rank() float64 {
	return float64(r.Size * max(len(r.Database), 1))
}

func isIn(num string, params []string) int {
	for i, param := range params {
		if num == param {
			return i
		}
	}

	return -1
}

func NewSearchJobRequest(query string, dbs []string, validDbs []Params, mode string, resultPath string, email string) (JobRequest, error) {
	job := SearchJob{
		max(strings.Count(query, ">"), 1),
		dbs,
		mode,
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
		ids[i] = item.Display.Path
	}

	paths := make([]string, len(job.Database))
	for i, item := range job.Database {
		idx := isIn(item, ids)
		if idx == -1 {
			return request, errors.New("Selected databases are not valid!")
		} else {
			paths[i] = validDbs[idx].Display.Path
		}
	}

	id := request.Id
	path := filepath.Join(resultPath, string(id))
	if _, err := os.Stat(path); os.IsNotExist(err) {
		err = os.Mkdir(path, 0755)
		if err != nil {
			return request, err
		}
	}

	err := ioutil.WriteFile(filepath.Join(path, "job.fasta"), []byte(query), 0644)
	if err != nil {
		return request, err
	}

	return request, nil
}
