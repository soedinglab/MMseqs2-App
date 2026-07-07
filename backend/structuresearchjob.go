package main

import (
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

type StructureSearchJob struct {
	Size            int      `json:"size" validate:"required"`
	Database        []string `json:"database" validate:"required"`
	Mode            string   `json:"mode" validate:"required,mode=3di tmalign 3diaa lolalign;print3di"`
	IterativeSearch bool     `json:"iterativesearch"`
	TaxFilter       string   `json:"taxfilter"`
	query           string
	queries         []string
}

func (r StructureSearchJob) IsBatch() bool {
	return len(r.queries) > 0
}

func (r StructureSearchJob) Hash() Id {
	h := sha256.New224()
	h.Write(([]byte)(JobStructureSearch))
	h.Write([]byte(r.query))
	for _, q := range r.queries {
		h.Write([]byte(q))
	}
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

func (r StructureSearchJob) Rank() float64 {
	modeFactor := 1
	if r.Mode == "tmalign" {
		modeFactor = 32
	}
	return float64(r.Size * max(len(r.Database), 1) * modeFactor)
}

func (r StructureSearchJob) WritePDB(path string) error {
	err := os.WriteFile(path, []byte(r.query), 0644)
	if err != nil {
		return err
	}
	return nil
}

// WriteBatchDir writes each query structure to a separate file in a
// "queries" subdirectory. foldseek easy-search accepts a directory as
// input and will search all structures inside it.
func (r StructureSearchJob) WriteBatchDir(basePath string) error {
	dir := filepath.Join(basePath, "queries")
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}
	for i, q := range r.queries {
		ext := ".pdb"
		if len(q) > 0 && ismmCIFFirstLine(strings.TrimSpace(q)) {
			ext = ".cif"
		}
		filename := fmt.Sprintf("query_%d%s", i, ext)
		if err := os.WriteFile(filepath.Join(dir, filename), []byte(q), 0644); err != nil {
			return err
		}
	}
	return nil
}

func NewStructureSearchJobRequest(query string, dbs []string, validDbs []Params, mode string, resultPath string, email string, iterativeSearch bool, taxfilter string) (JobRequest, error) {
	job := StructureSearchJob{
		Size:            max(strings.Count(query, "HEADER"), 1),
		Database:        dbs,
		Mode:            mode,
		IterativeSearch: iterativeSearch,
		TaxFilter:       taxfilter,
		query:           query,
	}

	request := JobRequest{
		Id:    job.Hash(),
		Status: StatusPending,
		Type:  JobStructureSearch,
		Job:   job,
		Email: email,
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
	}

	if !validTaxonFilter(taxfilter) {
		return request, errors.New("invalid taxon filter")
	}

	return request, nil
}

func NewStructureSearchBatchJobRequest(queries []string, dbs []string, validDbs []Params, mode string, resultPath string, email string, taxfilter string) (JobRequest, error) {
	if len(queries) == 0 {
		return JobRequest{}, errors.New("at least one query is required")
	}

	totalSize := 0
	for _, q := range queries {
		totalSize += max(strings.Count(q, "HEADER"), 1)
	}

	job := StructureSearchJob{
		Size:     totalSize,
		Database: dbs,
		Mode:     mode,
		TaxFilter: taxfilter,
		queries:  queries,
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
		if isIn(item, ids) == -1 {
			return request, errors.New("selected databases are not valid")
		}
	}

	if !validTaxonFilter(taxfilter) {
		return request, errors.New("invalid taxon filter")
	}

	return request, nil
}
