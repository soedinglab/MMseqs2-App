package main

import (
	"crypto/sha256"
	"encoding/base64"
	"os"
	"path/filepath"
	"strings"
)

type FoldMasonMSAJob struct {
	Queries   []string `json:"queries"`
	FileNames []string `json:"fileNames"`
}

func (r FoldMasonMSAJob) Hash() Id {
	h := sha256.New224()
	h.Write(([]byte)(JobFoldMasonMSA))
	for _, query := range r.Queries {
		h.Write([]byte(query))
	}
	bs := h.Sum(nil)
	return Id(base64.URLEncoding.WithPadding(base64.NoPadding).EncodeToString(bs))
}

func (r FoldMasonMSAJob) Rank() float64 {
	if len(r.Queries) == 0 {
		return 0
	}
	return float64(len(r.Queries) * len(r.Queries[0]))
}

func (r FoldMasonMSAJob) WritePDB(path string) error {
	var pdbDir = filepath.Join(path, "pdbs")
	os.Mkdir(pdbDir, os.ModePerm)
	for idx, query := range r.Queries {
		name := cleanPathComponent.ReplaceAllString(r.FileNames[idx], "")
		ext := filepath.Ext(r.FileNames[idx])
		if ext == ".cif" || ext == ".mmcif" {
			name = strings.TrimSuffix(name, ext) + ".cif"
		}
		err := os.WriteFile(filepath.Join(pdbDir, name), []byte(query), 0644)
		if err != nil {
			return err
		}
	}
	return nil
}

func NewFoldMasonMSAJobRequest(
	queries []string,
	fileNames []string,
	gapOpen int64,
	gapExtend int64,
) (JobRequest, error) {
	job := FoldMasonMSAJob{
		queries,
		fileNames,
	}
	request := JobRequest{
		job.Hash(),
		StatusPending,
		JobFoldMasonMSA,
		job,
		"",
	}
	return request, nil
}
