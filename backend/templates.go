package main

import (
	"archive/tar"
	"compress/gzip"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

func unique(slice []string) []string {
	check := make(map[string]bool, 0)
	unique := make([]string, 0)
	for _, e := range slice {
		if len(e) != 0 && !check[e] {
			unique = append(unique, e)
			check[e] = true
		}
	}
	return unique
}

func AddTarEntry(tw *tar.Writer, name string, s string, now time.Time) error {
	header := new(tar.Header)
	header.Name = name
	header.Size = int64(len(s))
	header.Mode = int64(0666)
	header.ModTime = now
	if err := tw.WriteHeader(header); err != nil {
		return err
	}
	if _, err := tw.Write([]byte(s)); err != nil {
		return err
	}
	return nil
}

func GatherTemplates(w io.Writer, templates []string, a3m Reader[string], pdbdivided string, pdbobsolete string) (err error) {
	gw := gzip.NewWriter(w)
	tw := tar.NewWriter(gw)

	uniques := make([]string, len(templates))
	uniquesWithoutChains := make([]string, len(templates))
	for i := 0; i < len(templates); i++ {
		key := templates[i]
		slice := strings.Split(key, "_")
		if len(slice) != 2 {
			continue
		}
		uniques = append(uniques, key)
		uniquesWithoutChains = append(uniquesWithoutChains, slice[0])
	}
	uniques = unique(uniques)
	uniquesWithoutChains = unique(uniquesWithoutChains)

	sort.Strings(uniques)
	sort.Strings(uniquesWithoutChains)

	a3mOffset := 0
	a3mData := strings.Builder{}
	a3mIndex := strings.Builder{}

	for i := 0; i < len(uniques); i++ {
		a3mid, ok := a3m.Id(uniques[i])
		if !ok {
			continue
		}

		entry := a3m.Data(a3mid)
		entryLen := len(entry) + 1
		a3mData.WriteString(entry)
		a3mData.WriteRune(rune(0))
		a3mIndex.WriteString(fmt.Sprintf("%s\t%d\t%d\n", uniques[i], a3mOffset, entryLen))
		a3mOffset += entryLen
	}

	now := time.Now()
	if err := AddTarEntry(tw, "pdb70_a3m.ffdata", a3mData.String(), now); err != nil {
		return err
	}
	if err := AddTarEntry(tw, "pdb70_a3m.ffindex", a3mIndex.String(), now); err != nil {
		return err
	}

	for i := 0; i < len(uniquesWithoutChains); i++ {
		pdbacc := strings.ToLower(uniquesWithoutChains[i])
		if len(pdbacc) < 4 {
			return fmt.Errorf("invalid PDB accession %s", pdbacc)
		}

		pdbmid := pdbacc[1:3]

		file, err := os.Open(filepath.Join(pdbdivided, pdbmid, pdbacc+".cif.gz"))
		if errors.Is(err, os.ErrNotExist) {
			file, err = os.Open(filepath.Join(pdbobsolete, pdbmid, pdbacc+".cif.gz"))
			if err != nil {
				return err
			}
		} else if err != nil {
			return err
		}

		reader, err := gzip.NewReader(file)
		if err != nil {
			return err
		}

		cif, err := ioutil.ReadAll(reader)
		if err != nil {
			return err
		}

		if err := AddTarEntry(tw, pdbacc+".cif", string(cif), now); err != nil {
			return err
		}

		if err := reader.Close(); err != nil {
			return err
		}

		if err := file.Close(); err != nil {
			return err
		}
	}

	if err := tw.Close(); err != nil {
		return err
	}

	if err := gw.Close(); err != nil {
		return err
	}

	return nil
}
