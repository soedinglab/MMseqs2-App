package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"encoding/json"
	"errors"
	"os/exec"
	"strconv"
)

type ParamsDisplay struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Version string `json:"version"`
	Default bool   `json:"default"`
	Order   int    `json:"order"`
}

type ByOrder []Params

func (d ByOrder) Len() int {
	return len(d)
}
func (d ByOrder) Swap(i, j int) {
	d[i], d[j] = d[j], d[i]
}
func (d ByOrder) Less(i, j int) bool {
	return d[i].Display.Order < d[j].Display.Order
}

type ParamsMMseqs struct {
	Profile         bool   `json:"profile"`
	MaxSeqLen       int    `json:"maxseqlen"`
	Search          string `json:"search"`
	Convertalis     string `json:"convertalis"`
	Summarizeresult string `json:"summarizeresult"`
}

type Params struct {
	Display ParamsDisplay `json:"display"`
	Params  ParamsMMseqs  `json:"params"`
}

func MaxEntryLength(index string) (int, error) {
	f, err := os.Open(index)
	if err != nil {
		return -1, err
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	maxLen := 0
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 3 {
			return -1, errors.New("Invalid index file")
		}

		length, err := strconv.Atoi(fields[2])
		if err != nil {
			return -1, err
		}

		maxLen = max(maxLen, length)
	}

	return maxLen, nil
}

func QuickExec(command string, params ...string) error {
	if _, exists := os.LookupEnv("MMSEQS_WEB_DEBUG"); exists {
		fmt.Println(strings.Join(params, " "))
	}
	cmd := exec.Command(command, params...)
	if _, exists := os.LookupEnv("MMSEQS_WEB_DEBUG"); exists {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}

	err := cmd.Run()
	if err != nil {
		return err
	}

	return nil
}

func FileExists(file string) bool {
	_, err := os.Stat(file)
	return !os.IsNotExist(err)
}

func ParseSense(parameters string) (int, error) {
	arr := strings.Fields(parameters)
	for i, value := range arr {
		if value == "-s" {
			if i+1 < len(arr) {
				sens, err := strconv.Atoi(arr[i+1])

				if err != nil {
					return sens, err
				}

				return -1, nil
			}

			return -1, errors.New("Invalid parameter string!")
		}
	}

	return -1, nil
}

//"apiEndpoint": "https://search.mmseqs.com/"
func CheckDatabase(params Params, basepath string, mmseqs string) error {
	if FileExists(basepath+".fasta") && !FileExists(basepath) && !FileExists(basepath+".index") {
		err := QuickExec(mmseqs, "createdb", basepath+".fasta", basepath)
		if err != nil {
			return err
		}

		maxSeqLen, err := MaxEntryLength(basepath + ".index")
		if err != nil {
			return err
		}

		maxSeqLen = max(maxSeqLen, 32000)
		err = QuickExec(mmseqs, "createindex", basepath, "tmp", "--mask", "2", "--include-headers", "--max-seq-len", strconv.Itoa(maxSeqLen))
		if err != nil {
			return err
		}
	} else if FileExists(basepath+"_msa") && FileExists(basepath+"_msa.index") && !FileExists(basepath) && !FileExists(basepath+".index") {
		err := QuickExec(mmseqs, "msa2profile", basepath+"_msa", basepath)
		if err != nil {
			return err
		}

		maxSeqLen, err := MaxEntryLength(basepath + ".index")
		if err != nil {
			return err
		}

		sens, err := ParseSense(params.Params.Search)
		if err != nil {
			return err
		}

		maxSeqLen = max(maxSeqLen, 32000)
		// TODO fix tmp
		cmdParams := []string{"createindex", basepath, "tmp", "-k", "5", "--mask", "2", "--include-headers", "--max-seq-len", strconv.Itoa(maxSeqLen)}

		if sens != -1 {
			cmdParams = append(cmdParams, "-s")
			cmdParams = append(cmdParams, strconv.Itoa(sens))
		}

		err = QuickExec(mmseqs, cmdParams...)
		if err != nil {
			return err
		}
	}

	f, err := os.Create(basepath + ".params")
	if err != nil {
		return err
	}
	defer f.Close()

	err = json.NewEncoder(f).Encode(params)
	if err != nil {
		return err
	}

	return nil
}

func Databases(basepath string) ([]Params, error) {
	matches, err := filepath.Glob(filepath.Clean(basepath) + "/*.params")
	if err != nil {
		return nil, err
	}

	var res []Params
	for _, value := range matches {
		f, err := os.Open(value)
		if err != nil {
			return nil, err
		}

		var params Params
		err = DecodeJsonAndValidate(bufio.NewReader(f), &params)
		if err != nil {
			return nil, err
		}

		base := filepath.Base(value)
		name := strings.TrimSuffix(base, filepath.Ext(base))
		params.Display.Path = name

		res = append(res, params)
	}

	sort.Sort(ByOrder(res))

	return res, nil
}
