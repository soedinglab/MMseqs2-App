package controller

import (
	"bufio"
	"os"
	"path/filepath"
	"sort"
	"crypto/sha256"
	"strings"
	"encoding/hex"

	"../decoder"

)

type ParamsDisplay struct {
	Hash    string `json:"hash"`
	Path    string `json:"-"`
	Name    string `json:"name"`
	Version string `json:"version"`
	Default bool   `json:"default"`
	Order   int    `json:"order"`
}

type ByOrder []ParamsDisplay

func (d ByOrder) Len() int {
	return len(d)
}
func (d ByOrder) Swap(i, j int) {
	d[i], d[j] = d[j], d[i]
}
func (d ByOrder) Less(i, j int) bool {
	return d[i].Order < d[j].Order
}

type ParamsMMseqs struct {
	Search          string `json:"search"`
	Convertalis     string `json:"convertalis"`
	Summarizeresult string `json:"summarizeresult"`
}

type Params struct {
	Display ParamsDisplay `json:"display"`
	Params  ParamsMMseqs  `json:"params"`
}

func Databases(basepath string) ([]ParamsDisplay, error) {
	matches, err := filepath.Glob(filepath.Clean(basepath) + "/*.params")
	if err != nil {
		return nil, err
	}

	var res []ParamsDisplay
	for _, value := range matches {
		f, err := os.Open(value)
		if err != nil {
			return nil, err
		}

		var params Params
		err = decoder.DecodeAndValidate(bufio.NewReader(f), &params)
		if err != nil {
			return nil, err
		}

		base := filepath.Base(value)
		name := strings.TrimSuffix(base, filepath.Ext(base))
		params.Display.Path = name

		hasher := sha256.New()
		hasher.Write([]byte(params.Display.Path + params.Display.Name + params.Display.Version))
		params.Display.Hash = hex.EncodeToString(hasher.Sum(nil))

		res = append(res, params.Display)
	}

	sort.Sort(ByOrder(res))

	return res, nil
}
