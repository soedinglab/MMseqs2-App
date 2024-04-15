package main

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"io"
	"os"
	"path/filepath"
	"strings"
)

type AlignmentEntry struct {
	Query         string      `json:"query"`
	Target        string      `json:"target"`
	SeqId         float32     `json:"seqId"`
	AlnLength     int         `json:"alnLength"`
	Missmatches   int         `json:"missmatches"`
	Gapsopened    int         `json:"gapsopened"`
	QueryStartPos int         `json:"qStartPos"`
	QueryEndPos   int         `json:"qEndPos"`
	DbStartPos    int         `json:"dbStartPos"`
	DbEndPos      int         `json:"dbEndPos"`
	Eval          float64     `json:"eval"`
	Score         int         `json:"score"`
	QueryLength   int         `json:"qLen"`
	DbLength      int         `json:"dbLen"`
	QueryAln      string      `json:"qAln"`
	DbAln         string      `json:"dbAln"`
	TaxonId       json.Number `json:"taxId,omitempty"`
	TaxonName     string      `json:"taxName,omitempty"`
}

type FoldseekAlignmentEntry struct {
	Query         string      `json:"query"`
	Target        string      `json:"target"`
	SeqId         float32     `json:"seqId"`
	AlnLength     int         `json:"alnLength"`
	Missmatches   int         `json:"missmatches"`
	Gapsopened    int         `json:"gapsopened"`
	QueryStartPos int         `json:"qStartPos"`
	QueryEndPos   int         `json:"qEndPos"`
	DbStartPos    int         `json:"dbStartPos"`
	DbEndPos      int         `json:"dbEndPos"`
	Prob          float32     `json:"prob"`
	Eval          float64     `json:"eval"`
	Score         int         `json:"score"`
	QueryLength   int         `json:"qLen"`
	DbLength      int         `json:"dbLen"`
	QueryAln      string      `json:"qAln"`
	DbAln         string      `json:"dbAln"`
	TargetCa      string      `json:"tCa"`
	TargetSeq     string      `json:"tSeq"`
	TaxonId       json.Number `json:"taxId,omitempty"`
	TaxonName     string      `json:"taxName,omitempty"`
}

type ComplexAlignmentEntry struct {
	Query           string      `json:"query"`
	Target          string      `json:"target"`
	SeqId           float32     `json:"seqId"`
	AlnLength       int         `json:"alnLength"`
	Missmatches     int         `json:"missmatches"`
	Gapsopened      int         `json:"gapsopened"`
	QueryStartPos   int         `json:"qStartPos"`
	QueryEndPos     int         `json:"qEndPos"`
	DbStartPos      int         `json:"dbStartPos"`
	DbEndPos        int         `json:"dbEndPos"`
	Prob            float32     `json:"prob"`
	Eval            float64     `json:"eval"`
	Score           int         `json:"score"`
	QueryLength     int         `json:"qLen"`
	DbLength        int         `json:"dbLen"`
	QueryAln        string      `json:"qAln"`
	DbAln           string      `json:"dbAln"`
	TargetCa        string      `json:"tCa"`
	TargetSeq       string      `json:"tSeq"`
	ComplexAssignId int         `json:"complexid"`
	ComplexQtmScore float32     `json:"complexqtm"`
	ComplexTtmScore float32     `json:"complexttm"`
	ComplexU        string      `json:"complexu"`
	ComplexT        string      `json:"complext"`
	TaxonId         json.Number `json:"taxId,omitempty"`
	TaxonName       string      `json:"taxName,omitempty"`
}

type EmptyEntry struct{}

type FastaEntry struct {
	Header   string `json:"header"`
	Sequence string `json:"sequence"`
}

type SearchResult struct {
	Database   string      `json:"db"`
	Alignments interface{} `json:"alignments"`
}

type AlignmentResponse struct {
	Queries []FastaEntry   `json:"queries"`
	Results []SearchResult `json:"results"`
}

func dbpaths(path string) (string, string) {
	return path, path + ".index"
}

type AlignmentParser func(Id, []int64, string) (AlignmentResponse, error)

func ReadAlignments[T any](id Id, entries []int64, jobsbase string) (AlignmentResponse, error) {
	base := filepath.Join(jobsbase, string(id))
	matches, err := filepath.Glob(filepath.Join(filepath.Clean(base), "alis_*.index"))
	if err != nil {
		return AlignmentResponse{}, err
	}

	reader := Reader[uint32]{}
	res := make([]SearchResult, 0)
	for _, item := range matches {
		name := strings.TrimSuffix(item, ".index")
		err := reader.Make(dbpaths(name))
		if err != nil {
			return AlignmentResponse{}, err
		}
		all := make([][]T, 0)
		for _, entry := range entries {
			var results []T
			r := new(T)
			data := strings.NewReader(reader.Data(entry))
			parser := NewTsvParser(data, r)
			for {
				eof, err := parser.Next()
				if eof {
					break
				}
				if err != nil {
					reader.Delete()
					return AlignmentResponse{}, err
				}
				results = append(results, *r)
			}
			if len(results) == 0 {
				continue
			}
			all = append(all, results)
		}
		reader.Delete()
		base := filepath.Base(name)
		res = append(res, SearchResult{strings.TrimPrefix(base, "alis_"), all})
	}

	query := filepath.Join(base, "query")

	seqReader := Reader[uint32]{}
	err = seqReader.Make(dbpaths(query))
	if err != nil {
		return AlignmentResponse{}, err
	}
	hdrReader := Reader[uint32]{}
	err = hdrReader.Make(dbpaths(query + "_h"))
	if err != nil {
		seqReader.Delete()
		return AlignmentResponse{}, err
	}

	fasta := make([]FastaEntry, 0)
	for _, entry := range entries {
		sequence := strings.TrimSpace(seqReader.Data(entry))
		seqReader.Delete()
		header := strings.TrimSpace(hdrReader.Data(entry))
		hdrReader.Delete()
		fasta = append(fasta, FastaEntry{header, sequence})
	}
	seqReader.Delete()
	hdrReader.Delete()

	return AlignmentResponse{fasta, res}, nil
}

func Alignments(id Id, entry []int64, jobsbase string) (AlignmentResponse, error) {
	return ReadAlignments[AlignmentEntry](id, entry, jobsbase)
}

func FSAlignments(id Id, entry []int64, jobsbase string) (AlignmentResponse, error) {
	return ReadAlignments[FoldseekAlignmentEntry](id, entry, jobsbase)
}

func ComplexAlignments(id Id, entry []int64, jobsbase string) (AlignmentResponse, error) {
	return ReadAlignments[ComplexAlignmentEntry](id, entry, jobsbase)
}

func NullParser(id Id, entry []int64, jobsbase string) (AlignmentResponse, error) {
	return AlignmentResponse{}, nil
}

func addFile(tw *tar.Writer, path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}

	if stat, err := file.Stat(); err == nil {
		header := new(tar.Header)
		header.Name = filepath.Base(path)
		header.Size = stat.Size()
		header.Mode = int64(stat.Mode())
		header.ModTime = stat.ModTime()
		if err := tw.WriteHeader(header); err != nil {
			file.Close()
			return err
		}
		if _, err := io.Copy(tw, file); err != nil {
			file.Close()
			return err
		}
	}

	err = file.Close()
	if err != nil {
		return err
	}

	return nil
}

func ResultArchive(w io.Writer, id Id, base string) (err error) {
	gw := gzip.NewWriter(w)
	defer func() {
		cerr := gw.Close()
		if err == nil {
			err = cerr
		}
	}()
	tw := tar.NewWriter(gw)
	defer func() {
		cerr := tw.Close()
		if err == nil {
			err = cerr
		}
	}()

	matches, err := filepath.Glob(filepath.Join(base, "alis_*.index"))
	if err != nil {
		return err
	}

	reader := Reader[uint32]{}
	for _, item := range matches {
		name := strings.TrimSuffix(item, ".index")

		result, err := os.Create(name + ".m8")
		if err != nil {
			return err
		}
		err = reader.Make(dbpaths(name))
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
		reader.Delete()
		err = result.Close()
		if err != nil {
			return err
		}
		if err = addFile(tw, name+".m8"); err != nil {
			return err
		}
	}
	return nil
}
