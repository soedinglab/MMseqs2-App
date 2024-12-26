package main

import (
	"archive/tar"
	"bufio"
	"bytes"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
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

type MarshalFormat int

const (
	MarshalDefault       MarshalFormat = 0
	MarshalTargetNumeric MarshalFormat = 1
	MarshalTargetOnly    MarshalFormat = 2
)

type FoldseekAlignmentEntry struct {
	MarshalFormat MarshalFormat `json:"-"`
	Query         string        `json:"query"`
	Target        string        `json:"target"`
	SeqId         float32       `json:"seqId"`
	AlnLength     int           `json:"alnLength"`
	Missmatches   int           `json:"missmatches"`
	Gapsopened    int           `json:"gapsopened"`
	QueryStartPos int           `json:"qStartPos"`
	QueryEndPos   int           `json:"qEndPos"`
	DbStartPos    int           `json:"dbStartPos"`
	DbEndPos      int           `json:"dbEndPos"`
	Prob          float32       `json:"prob"`
	Eval          float64       `json:"eval"`
	Score         int           `json:"score"`
	QueryLength   int           `json:"qLen"`
	DbLength      int           `json:"dbLen"`
	QueryAln      string        `json:"qAln"`
	DbAln         string        `json:"dbAln"`
	TargetCa      string        `json:"tCa"`
	TargetSeq     string        `json:"tSeq"`
	TaxonId       json.Number   `json:"taxId,omitempty"`
	TaxonName     string        `json:"taxName,omitempty"`
}

func (entry FoldseekAlignmentEntry) MarshalJSON() ([]byte, error) {
	type Alias FoldseekAlignmentEntry

	if entry.MarshalFormat == MarshalDefault {
		return json.Marshal(&struct {
			*Alias
		}{
			Alias: (*Alias)(&entry),
		})
	} else if entry.MarshalFormat == MarshalTargetNumeric {
		targetCaInt, err := strconv.Atoi(entry.TargetCa)
		if err != nil {
			return nil, err
		}
		targetSeqInt, err := strconv.Atoi(entry.TargetSeq)
		if err != nil {
			return nil, err
		}

		return json.Marshal(&struct {
			*Alias
			TargetCa  int `json:"tCa"`
			TargetSeq int `json:"tSeq"`
		}{
			Alias:     (*Alias)(&entry),
			TargetCa:  targetCaInt,
			TargetSeq: targetSeqInt,
		})
	} else if entry.MarshalFormat == MarshalTargetOnly {
		return json.Marshal(&struct {
			TargetSeq string `json:"tSeq"`
			TargetCa  string `json:"tCa"`
		}{
			TargetSeq: entry.TargetSeq,
			TargetCa:  entry.TargetCa,
		})
	} else {
		return nil, nil
	}
}

type ComplexAlignmentEntry struct {
	MarshalFormat   MarshalFormat `json:"-"`
	Query           string        `json:"query"`
	Target          string        `json:"target"`
	SeqId           float32       `json:"seqId"`
	AlnLength       int           `json:"alnLength"`
	Missmatches     int           `json:"missmatches"`
	Gapsopened      int           `json:"gapsopened"`
	QueryStartPos   int           `json:"qStartPos"`
	QueryEndPos     int           `json:"qEndPos"`
	DbStartPos      int           `json:"dbStartPos"`
	DbEndPos        int           `json:"dbEndPos"`
	Prob            float32       `json:"prob"`
	Eval            float64       `json:"eval"`
	Score           int           `json:"score"`
	QueryLength     int           `json:"qLen"`
	DbLength        int           `json:"dbLen"`
	QueryAln        string        `json:"qAln"`
	DbAln           string        `json:"dbAln"`
	TargetCa        string        `json:"tCa"`
	TargetSeq       string        `json:"tSeq"`
	ComplexAssignId int           `json:"complexid"`
	ComplexQtmScore float32       `json:"complexqtm"`
	ComplexTtmScore float32       `json:"complexttm"`
	ComplexU        string        `json:"complexu"`
	ComplexT        string        `json:"complext"`
	TaxonId         json.Number   `json:"taxId,omitempty"`
	TaxonName       string        `json:"taxName,omitempty"`
}

func (entry ComplexAlignmentEntry) MarshalJSON() ([]byte, error) {
	type Alias ComplexAlignmentEntry

	if entry.MarshalFormat == MarshalDefault {
		return json.Marshal(&struct {
			*Alias
		}{
			Alias: (*Alias)(&entry),
		})
	} else if entry.MarshalFormat == MarshalTargetNumeric {
		targetCaInt, err := strconv.Atoi(entry.TargetCa)
		if err != nil {
			return nil, err
		}
		targetSeqInt, err := strconv.Atoi(entry.TargetSeq)
		if err != nil {
			return nil, err
		}

		return json.Marshal(&struct {
			*Alias
			TargetCa  int `json:"tCa"`
			TargetSeq int `json:"tSeq"`
		}{
			Alias:     (*Alias)(&entry),
			TargetCa:  targetCaInt,
			TargetSeq: targetSeqInt,
		})
	} else if entry.MarshalFormat == MarshalTargetOnly {
		return json.Marshal(&struct {
			TargetSeq string `json:"tSeq"`
			TargetCa  string `json:"tCa"`
		}{
			TargetSeq: entry.TargetSeq,
			TargetCa:  entry.TargetCa,
		})
	} else {
		return nil, nil
	}
}

type EmptyEntry struct{}

type FastaEntry struct {
	Header   string `json:"header"`
	Sequence string `json:"sequence"`
}

type SearchResult struct {
	Database   string      `json:"db"`
	Alignments interface{} `json:"alignments"`
	TaxonomyReport interface{} `json:"taxonomyreport"`
}

type TaxonomyReport struct {
    Proportion    float64 `json:"proportion"`
    CladeReads    int     `json:"clade_reads"`
    TaxonReads    int     `json:"taxon_reads"`
    Rank          string  `json:"rank"`
    TaxonID       string  `json:"taxon_id"`
    ScientificName string `json:"name"`
}

func dbpaths(path string) (string, string) {
	return path, path + ".index"
}

func ReadAlignment[T any](reader io.Reader) ([]T, error) {
	var results []T
	r := new(T)
	parser := NewTsvParser(reader, r)
	for {
		eof, err := parser.Next()
		if eof {
			break
		}
		if err != nil {
			return results, err
		}
		results = append(results, *r)
	}
	return results, nil
}

func ReadQueryByIds(id Id, ids []int64, jobsbase string) ([]FastaEntry, error) {
	base := filepath.Join(jobsbase, string(id))
	query := filepath.Join(base, "query")
	seqReader := Reader[uint32]{}
	err := seqReader.Make(dbpaths(query))
	fasta := make([]FastaEntry, 0)
	if err != nil {
		return fasta, err
	}
	hdrReader := Reader[uint32]{}
	err = hdrReader.Make(dbpaths(query + "_h"))
	if err != nil {
		seqReader.Delete()
		return fasta, err
	}

	for _, id := range ids {
		sequence := strings.TrimSpace(seqReader.Data(id))
		header := strings.TrimSpace(hdrReader.Data(id))
		fasta = append(fasta, FastaEntry{header, sequence})
	}
	seqReader.Delete()
	hdrReader.Delete()
	return fasta, nil
}

func ReadQueryByKeys(id Id, keys []uint32, jobsbase string) ([]FastaEntry, error) {
	base := filepath.Join(jobsbase, string(id))
	query := filepath.Join(base, "query")
	seqReader := Reader[uint32]{}
	err := seqReader.Make(dbpaths(query))
	fasta := make([]FastaEntry, 0)
	if err != nil {
		return fasta, err
	}
	hdrReader := Reader[uint32]{}
	err = hdrReader.Make(dbpaths(query + "_h"))
	if err != nil {
		seqReader.Delete()
		return fasta, err
	}

	for _, key := range keys {
		id, found := seqReader.Id(key)
		sequence := ""
		if found {
			sequence = strings.TrimSpace(seqReader.Data(id))
		}
		id, found = hdrReader.Id(key)
		header := ""
		if found {
			header = strings.TrimSpace(hdrReader.Data(id))
		}
		fasta = append(fasta, FastaEntry{header, sequence})
	}
	seqReader.Delete()
	hdrReader.Delete()
	return fasta, nil
}

func ReadAlignments[T any, U interface{ ~uint32 | ~int64 }](id Id, entries []U, databases []string, jobsbase string) ([]SearchResult, error) {
	base := filepath.Join(jobsbase, string(id))
	reader := Reader[uint32]{}
	res := make([]SearchResult, 0)

	var lookupByKey bool
	switch any(entries[0]).(type) {
	case uint32:
		lookupByKey = true
	case int64:
		lookupByKey = false
	default:
		return nil, fmt.Errorf("unsupported type: %T", entries[0])
	}

	for _, db := range databases {
		name := filepath.Join(filepath.Clean(base), "alis_"+db)
		err := reader.Make(dbpaths(name))
		if err != nil {
			return res, err
		}
		all := make([][]T, 0)
		for _, entry := range entries {
			var body string
			if lookupByKey {
				alnKey := any(entry).(uint32)
				alnId, found := reader.Id(alnKey)
				if !found {
					reader.Delete()
					return nil, fmt.Errorf("missing key: %T", alnKey)
				}
				body = reader.Data(alnId)
			} else {
				body = reader.Data(any(entry).(int64))
			}
			data := strings.NewReader(body)
			results, err := ReadAlignment[T](data)
			if err != nil {
				reader.Delete()
				return res, err
			}
			if len(results) == 0 {
				continue
			}
			all = append(all, results)
		}
		reader.Delete()

		// Read the taxonomy report
        taxonomyReportPath := filepath.Join(base, "alis_" + db + "_report")
        taxonomyReport, _ := ReadTaxonomyReport(taxonomyReportPath)

		base := filepath.Base(name)
		res = append(res, SearchResult{
			strings.TrimPrefix(base, "alis_"), 
			all,
			taxonomyReport, // Include taxonomy report
			})
	}

	return res, nil
}

func ReadTaxonomyReport(filePath string) ([]TaxonomyReport, error) {
    file, err := os.Open(filePath)
    if err != nil {
        // Return an empty report for any error
        return []TaxonomyReport{}, nil
    }
    defer file.Close()

    var reports []TaxonomyReport
    scanner := bufio.NewScanner(file)

    for scanner.Scan() {
        line := scanner.Text()
        fields := strings.Split(line, "\t")
        if len(fields) < 6 {
			// Skip invalid lines
            continue
        }

        // Parse the fields
        proportion, err := strconv.ParseFloat(fields[0], 64)
        if err != nil {
            continue
        }

        cladeReads, err := strconv.Atoi(fields[1])
        if err != nil {
            continue
        }

        taxonReads, err := strconv.Atoi(fields[2])
        if err != nil {
            continue
        }

        report := TaxonomyReport{
            Proportion:    proportion,
            CladeReads:    cladeReads,
            TaxonReads:    taxonReads,
            Rank:          fields[3],
            TaxonID:       fields[4],
            ScientificName: strings.TrimSpace(fields[5]),
        }
        reports = append(reports, report)
    }

    return reports, nil
}

func Alignments(id Id, entry []int64, databases []string, jobsbase string) ([]SearchResult, error) {
	return ReadAlignments[AlignmentEntry, int64](id, entry, databases, jobsbase)
}

func FSAlignments(id Id, entry []int64, databases []string, jobsbase string) ([]SearchResult, error) {
	return ReadAlignments[FoldseekAlignmentEntry, int64](id, entry, databases, jobsbase)
}

func ComplexAlignments(id Id, entry []uint32, databases []string, jobsbase string) ([]SearchResult, error) {
	return ReadAlignments[ComplexAlignmentEntry, uint32](id, entry, databases, jobsbase)
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
