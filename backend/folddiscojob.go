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

type FoldDiscoJob struct {
	Size     int      `json:"size" validate:"required"`
	Database []string `json:"database" validate:"required"`
	// Mode      string   `json:"mode" validate:"oneof=3di tmalign 3diaa"`
	// TaxFilter string `json:"taxfilter"`
	Motif  string   `json:"motif"`
	Motifs []string `json:"motifs,omitempty"`
	Top    int      `json:"top,omitempty"`
	query  string
	queries []string
}

const FolddiscoCacheVersion string = "v1"

func (r FoldDiscoJob) Hash() Id {
	h := sha256.New224()
	h.Write([]byte(FolddiscoCacheVersion))
	h.Write(([]byte)(JobFoldDisco))
	h.Write([]byte(r.query))
	h.Write([]byte(r.Motif))
	h.Write([]byte(fmt.Sprintf("%d", r.Top)))
	for _, q := range r.queries {
		h.Write([]byte(q))
	}
	for _, m := range r.Motifs {
		h.Write([]byte(m))
	}
	// h.Write([]byte(r.Mode))
	// if r.TaxFilter != "" {
	// 	h.Write([]byte(r.TaxFilter))
	// }

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

func (r FoldDiscoJob) IsBatch() bool {
	return len(r.Motifs) > 0
}

func (r FoldDiscoJob) WriteBatchFiles(basePath string) error {
	var lines []string
	for i, q := range r.queries {
		ext := ".pdb"
		if len(q) > 0 && ismmCIFFirstLine(strings.TrimSpace(q)) {
			ext = ".cif"
		}
		filename := fmt.Sprintf("job_%d%s", i, ext)
		fp := filepath.Join(basePath, filename)
		if err := os.WriteFile(fp, []byte(q), 0644); err != nil {
			return err
		}
		lines = append(lines, fp+"\t"+r.Motifs[i])
	}
	content := strings.Join(lines, "\n") + "\n"
	return os.WriteFile(filepath.Join(basePath, "query_batch.txt"), []byte(content), 0644)
}

func validateFolddiscoDatabases(dbs []string, validDbs []Params) error {
	ids := make([]string, 0)
	for _, item := range validDbs {
		if item.Motif {
			ids = append(ids, item.Path)
		}
	}
	for _, item := range dbs {
		if isIn(item, ids) == -1 {
			return errors.New("selected databases are not valid")
		}
	}
	return nil
}

func NewFoldDiscoJobRequest(query string, motif string, dbs []string, validDbs []Params, resultPath string, email string, top int) (JobRequest, error) {
	if top <= 0 {
		top = 1000
	}
	job := FoldDiscoJob{
		Size:     max(strings.Count(query, "HEADER"), 1),
		Database: dbs,
		Motif:    motif,
		Top:      top,
		query:    query,
	}

	request := JobRequest{
		job.Hash(),
		StatusPending,
		JobFoldDisco,
		job,
		email,
	}

	if err := validateFolddiscoDatabases(dbs, validDbs); err != nil {
		return request, err
	}

	return request, nil
}

func NewFoldDiscoBatchJobRequest(queries []string, motifs []string, dbs []string, validDbs []Params, resultPath string, email string, top int) (JobRequest, error) {
	if len(queries) != len(motifs) {
		return JobRequest{}, errors.New("queries and motifs must have the same length")
	}
	if len(queries) == 0 {
		return JobRequest{}, errors.New("at least one query is required")
	}

	totalSize := 0
	for _, q := range queries {
		totalSize += max(strings.Count(q, "HEADER"), 1)
	}

	if top <= 0 {
		top = 1000
	}
	job := FoldDiscoJob{
		Size:     totalSize,
		Database: dbs,
		Motifs:   motifs,
		Top:      top,
		queries:  queries,
	}

	request := JobRequest{
		job.Hash(),
		StatusPending,
		JobFoldDisco,
		job,
		email,
	}

	if err := validateFolddiscoDatabases(dbs, validDbs); err != nil {
		return request, err
	}

	return request, nil
}
