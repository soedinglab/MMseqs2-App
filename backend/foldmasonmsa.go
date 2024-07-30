package main

import (
	"crypto/sha256"
	"encoding/base64"
	"os"
	"path/filepath"
	"strconv"
)

type FoldMasonMSAJob struct {
	Queries   []string `json:"queries"`
	FileNames []string `json:"fileNames"`
	GapOpen   int64    `json:"gapOpen"`
	GapExtend int64    `json:"gapExtend"`
}

func (r FoldMasonMSAJob) Hash() Id {
	h := sha256.New224()
	h.Write(([]byte)(JobFoldMasonMSA))
	for _, query := range r.Queries {
		h.Write([]byte(query))
	}
	h.Write([]byte(strconv.FormatInt(r.GapOpen, 10)))
	h.Write([]byte(strconv.FormatInt(r.GapExtend, 10)))
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
		// FIXME check CIF vs PDB here
		name := cleanPathComponent.ReplaceAllString(r.FileNames[idx], "")
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
		gapOpen,
		gapExtend,
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
