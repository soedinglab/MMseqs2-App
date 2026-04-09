package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"os"
	"path/filepath"
	"regexp"
)

type FoldMasonMSAJob struct {
	Queries   [][]byte `json:"queries"`
	FileNames []string `json:"fileNames"`
}

var foldMasonFileName = regexp.MustCompile(`[^a-zA-Z0-9_.-]+`)

func (j *FoldMasonMSAJob) UnmarshalJSON(data []byte) error {
	type current FoldMasonMSAJob
	var cur current
	if err := json.Unmarshal(data, &cur); err == nil {
		*j = FoldMasonMSAJob(cur)
		return nil
	}

	type legacy struct {
		Queries   []string `json:"queries"`
		FileNames []string `json:"fileNames"`
	}
	var old legacy
	if err := json.Unmarshal(data, &old); err != nil {
		return err
	}

	j.FileNames = old.FileNames
	j.Queries = make([][]byte, len(old.Queries))
	for i, query := range old.Queries {
		j.Queries[i] = []byte(query)
	}

	return nil
}

func (r FoldMasonMSAJob) Hash() Id {
	h := sha256.New224()
	h.Write(([]byte)(JobFoldMasonMSA))
	for _, query := range r.Queries {
		h.Write(query)
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
		name := foldMasonFileName.ReplaceAllString(filepath.Base(r.FileNames[idx]), "")
		err := os.WriteFile(filepath.Join(pdbDir, name), query, 0644)
		if err != nil {
			return err
		}
	}
	return nil
}

func NewFoldMasonMSAJobRequest(
	queries [][]byte,
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
