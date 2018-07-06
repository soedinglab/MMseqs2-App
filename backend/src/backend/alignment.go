package main

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type AlignmentEntry struct {
	Query         string  `json:"query"`
	Target        string  `json:"target"`
	SeqId         float32 `json:"seqId"`
	AlnLength     int     `json:"alnLength"`
	Missmatches   int     `json:"missmatches"`
	Gapsopened    int     `json:"gapsopened"`
	QueryStartPos int     `json:"qStartPos"`
	QueryEndPos   int     `json:"qEndPos"`
	DbStartPos    int     `json:"dbStartPos"`
	DbEndPos      int     `json:"dbEndPos"`
	Eval          float64 `json:"eval"`
	Score         int     `json:"score"`
	QueryLength   int     `json:"qLen"`
	DbLength      int     `json:"dbLen"`
}

type FastaEntry struct {
	Header   string `json:"header"`
	Sequence string `json:"sequence"`
}

type SearchResult struct {
	Database   string           `json:"db"`
	Alignments []AlignmentEntry `json:"alignments"`
}

type AlignmentResponse struct {
	Query   FastaEntry     `json:"query"`
	Results []SearchResult `json:"results"`
}

func dbpaths(path string) (string, string) {
	return path, path + ".index"
}

func Alignments(id Id, entry int64, jobsbase string) (AlignmentResponse, error) {
	base := filepath.Join(jobsbase, string(id))
	matches, err := filepath.Glob(filepath.Join(filepath.Clean(base), "alis_*.index"))
	if err != nil {
		return AlignmentResponse{}, err
	}

	reader := Reader{}
	var res []SearchResult
	for _, item := range matches {
		name := strings.TrimSuffix(item, ".index")
		reader.Make(dbpaths(name))
		defer reader.Delete()

		data := strings.NewReader(reader.Data(entry))
		var results []AlignmentEntry
		r := AlignmentEntry{}
		parser := NewTsvParser(data, &r)
		for {
			eof, err := parser.Next()
			if eof {
				break
			}
			if err != nil {
				return AlignmentResponse{}, err
			}
			results = append(results, r)
		}

		base := filepath.Base(name)
		res = append(res, SearchResult{strings.TrimPrefix(base, "alis_"), results})
	}

	query := filepath.Join(base, "tmp", "latest", "query")
	reader.Make(dbpaths(query))
	sequence := strings.TrimSpace(reader.Data(entry))
	reader.Delete()

	reader.Make(dbpaths(query + "_h"))
	header := strings.TrimSpace(reader.Data(entry))
	reader.Delete()

	return AlignmentResponse{FastaEntry{header, sequence}, res}, nil
}

func addFile(tw *tar.Writer, path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	if stat, err := file.Stat(); err == nil {
		header := new(tar.Header)
		header.Name = filepath.Base(path)
		header.Size = stat.Size()
		header.Mode = int64(stat.Mode())
		header.ModTime = stat.ModTime()
		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		if _, err := io.Copy(tw, file); err != nil {
			return err
		}
	}
	return nil
}

func ResultArchive(w io.Writer, id Id, base string) error {
	gw := gzip.NewWriter(w)
	defer gw.Close()
	tw := tar.NewWriter(gw)
	defer tw.Close()

	matches, err := filepath.Glob(filepath.Join(base, "alis_*.index"))
	if err != nil {
		return err
	}

	reader := Reader{}
	for _, item := range matches {
		name := strings.TrimSuffix(item, ".index")

		reader.Make(dbpaths(name))
		defer reader.Delete()

		result, err := os.Create(name + ".m8")
		if err != nil {
			return err
		}

		for i := int64(0); i < reader.Size(); i++ {
			data := strings.NewReader(reader.Data(i))
			scanner := bufio.NewScanner(data)
			for scanner.Scan() {
				line := scanner.Bytes()
				bytes.Trim(line, "\x00")
				result.Write(line)
				result.Write([]byte{'\n'})
			}
		}
		result.Close()
		if err := addFile(tw, name+".m8"); err != nil {
			return err
		}
	}
	return nil
}
