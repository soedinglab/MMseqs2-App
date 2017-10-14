package main

import (
	"bufio"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"encoding/json"
	"errors"
	"github.com/milot-mirdita/mmseqs-web-backend/decoder"
	"github.com/spf13/viper"
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

		length, err := strconv.Atoi(fields[3])
		if err != nil {
			return -1, err
		}

		maxLen = max(maxLen, length)
	}

	return maxLen, nil
}

func QuickExec(command string, params ...string) error {
	cmd := exec.Command(command, params...)
	if _, exists := os.LookupEnv("MMSEQS_WEB_DEBUG"); exists {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}

	err := cmd.Start()
	if err != nil {
		return err
	}

	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

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
			} else {
				return -1, errors.New("Invalid parameter string!")
			}

			break
		}
	}

	return -1, nil
}

func CheckDatabase(params Params, path string) error {
	basepath := filepath.Clean(strings.TrimSuffix(path, filepath.Ext(path)))

	if FileExists(basepath+".fasta") && !FileExists(basepath) && !FileExists(basepath+".index") {
		err := QuickExec(viper.GetString("Mmseqs"), "createdb", basepath+".fasta", basepath)
		if err != nil {
			return err
		}

		maxSeqLen, err := MaxEntryLength(basepath + ".index")
		if err != nil {
			return err
		}

		maxSeqLen = max(maxSeqLen, 32000)
		err = QuickExec(viper.GetString("Mmseqs"), "createindex", basepath, "--mask", "2", "--include-headers", "--max-seq-len", strconv.Itoa(maxSeqLen))
		if err != nil {
			return err
		}

		params.Params.Profile = false
		params.Params.MaxSeqLen = maxSeqLen
	} else if FileExists(basepath+"_msa") && FileExists(basepath+"_msa.index") && !FileExists(basepath) && !FileExists(basepath+".index") {
		err := QuickExec(viper.GetString("Mmseqs"), "msa2profile", basepath+"_msa", basepath)
		if err != nil {
			return err
		}

		maxSeqLen, err := MaxEntryLength(basepath + ".index")
		if err != nil {
			return err
		}

		cmdParams := []string{"createindex", basepath, "--target-profile", "--mask", "2", "--include-headers", "--max-seq-len", strconv.Itoa(maxSeqLen)}

		sens, err := ParseSense(params.Params.Search)
		if err != nil {
			return err
		}

		if sens != -1 {
			cmdParams = append(cmdParams, "-s")
			cmdParams = append(cmdParams, strconv.Itoa(sens))
		}

		maxSeqLen = max(maxSeqLen, 32000)
		err = QuickExec(viper.GetString("Mmseqs"), cmdParams...)
		if err != nil {
			return err
		}

		params.Params.Profile = true
		params.Params.MaxSeqLen = maxSeqLen
	}

	f, err := os.Create(path)
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

		err = CheckDatabase(params, value)
		if err != nil {
			return nil, err
		}

		res = append(res, params.Display)
	}

	sort.Sort(ByOrder(res))

	return res, nil
}
