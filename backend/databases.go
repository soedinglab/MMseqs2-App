package main

import (
	"bufio"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"encoding/json"
	"errors"
	"os/exec"
	"strconv"
)

type Params struct {
	Name     string `json:"name" validate:"required"`
	Version  string `json:"version"`
	Path     string `json:"path" validate:"required"`
	Default  bool   `json:"default"`
	Order    int    `json:"order"`
	Taxonomy bool   `json:"taxonomy`
	Index    string `json:"index"`
	Search   string `json:"search"`
	Status   Status `json:"status"`
}

type paramsByOrder []Params

func (d paramsByOrder) Len() int {
	return len(d)
}
func (d paramsByOrder) Swap(i, j int) {
	d[i], d[j] = d[j], d[i]
}
func (d paramsByOrder) Less(i, j int) bool {
	return d[i].Order < d[j].Order
}

func CheckDatabase(basepath string, params Params, config ConfigRoot) error {
	verbose := config.Verbose
	if fileExists(basepath + ".fasta") {
		if !fileExists(basepath) && !fileExists(basepath+".index") {
			err := quickExec(
				config.Paths.Mmseqs,
				config.Verbose,
				"createdb",
				basepath+".fasta",
				basepath,
			)
			if err != nil {
				return err
			}
		}

		parameters := []string{
			"createindex",
			basepath,
			config.Paths.Temporary,
			"--remove-tmp-files",
			"true",
			"--check-compatible",
			"1",
		}
		parameters = append(parameters, strings.Fields(params.Index)...)
		err := quickExec(config.Paths.Mmseqs, config.Verbose, parameters...)
		if err != nil {
			return err
		}

		err = quickExec(config.Paths.Mmseqs, config.Verbose, "touchdb", basepath)
		if err != nil {
			return err
		}
		return nil
	}

	if fileExists(basepath+".sto") && !fileExists(basepath+"_msa") && !fileExists(basepath+"_msa.index") {
		err := quickExec(
			config.Paths.Mmseqs,
			config.Verbose,
			"convertmsa",
			basepath+".sto",
			basepath+"_msa",
			"--identifier-field",
			"1",
		)
		if err != nil {
			return err
		}
	}

	if fileExists(basepath+"_msa") && fileExists(basepath+"_msa.index") {
		if !fileExists(basepath) && !fileExists(basepath+".index") {
			err := quickExec(
				config.Paths.Mmseqs,
				config.Verbose,
				"msa2profile",
				basepath+"_msa",
				basepath,
				"--match-mode",
				"1",
			)
			if err != nil {
				return err
			}
		}

		parameters := []string{
			"createindex",
			basepath,
			config.Paths.Temporary,
			"-k",
			"5",
			"--remove-tmp-files",
			"true",
			"--check-compatible",
			"1",
		}
		parameters = append(parameters, strings.Fields(params.Index)...)
		err := quickExec(config.Paths.Mmseqs, verbose, parameters...)
		if err != nil {
			return err
		}

		err = quickExec(config.Paths.Mmseqs, verbose, "touchdb", basepath)
		if err != nil {
			return err
		}

		return nil
	}

	return nil
}

func UpgradeParams(filename string) (Params, error) {
	var paramsNew Params
	file, err := os.Open(filename)
	if err != nil {
		return paramsNew, err
	}

	type ParamsV1 struct {
		Name    string `json:"name" validate:"required"`
		Version string `json:"version"`
		Path    string `json:"path" validate:"required"`
		Default bool   `json:"default"`
		Order   int    `json:"order"`
		Index   string `json:"index"`
		Search  string `json:"search"`
	}

	type ParamsDisplayV1 struct {
		Status  Status   `json:"status" validate:"required"`
		Display ParamsV1 `json:"display" validate:"required"`
	}

	var paramsOld ParamsDisplayV1
	err = DecodeJsonAndValidate(bufio.NewReader(file), &paramsOld)
	file.Close()
	if err != nil {
		return paramsNew, err
	}

	paramsNew.Name = paramsOld.Display.Name
	paramsNew.Version = paramsOld.Display.Version
	paramsNew.Path = paramsOld.Display.Path
	paramsNew.Default = paramsOld.Display.Default
	paramsNew.Order = paramsOld.Display.Order
	paramsNew.Index = paramsOld.Display.Index
	paramsNew.Search = paramsOld.Display.Search
	paramsNew.Status = paramsOld.Status

	err = SaveParams(filename, paramsNew)
	if err != nil {
		return paramsNew, err
	}
	return paramsNew, nil
}

func ReadParams(filename string) (Params, error) {
	var params Params
	file, err := os.Open(filename)
	if err != nil {
		return params, err
	}

	err = DecodeJsonAndValidate(bufio.NewReader(file), &params)
	file.Close()
	if err != nil {
		params, err = UpgradeParams(filename)
		if err != nil {
			return params, err
		}
	}

	return params, nil
}

func SaveParams(file string, params Params) error {
	f, err := os.Create(file)
	if err != nil {
		return err
	}

	err = json.NewEncoder(f).Encode(params)
	if err != nil {
		f.Close()
		return err
	}

	err = f.Close()
	if err != nil {
		return err
	}

	return nil
}

func Databases(basepath string, complete bool) ([]Params, error) {
	matches, err := filepath.Glob(filepath.Clean(basepath) + "/*.params")
	if err != nil {
		return nil, err
	}

	var res []Params
	for _, value := range matches {
		params, err := ReadParams(value)
		if err != nil {
			return nil, err
		}

		if complete && params.Status != StatusComplete {
			continue
		}

		base := filepath.Base(value)
		name := strings.TrimSuffix(base, filepath.Ext(base))

		if params.Path != name {
			params.Path = name
			err = SaveParams(value, params)
			if err != nil {
				return nil, err
			}
		}

		res = append(res, params)
	}

	sort.Sort(paramsByOrder(res))

	return res, nil
}

func ReorderDatabases(basepath string, paths []string) ([]Params, error) {
	res, err := Databases(basepath, true)
	if err != nil {
		return nil, err
	}

	if len(paths) != len(res) {
		return nil, errors.New("Invalid argument length")
	}

	for i, path := range paths {
		found := false
		for j := 0; j < len(res); j++ {
			db := &res[j]
			if db.Path == path {
				found = true
				db.Order = i

				err := SaveParams(filepath.Join(basepath, path+".params"), *db)
				if err != nil {
					return nil, err
				}

				break
			}
		}

		if found == false {
			return nil, errors.New(path + " not found")
		}
	}

	sort.Sort(paramsByOrder(res))

	return res, nil
}

var cleanPathComponent = regexp.MustCompile("[^a-zA-Z0-9_\\-]+")

func SafePath(base, name, version string) string {
	name = cleanPathComponent.ReplaceAllString(name, "")
	version = cleanPathComponent.ReplaceAllString(version, "")
	cnt := 0

	result := ""
	for {
		result = name + "_" + version + "_" + strconv.Itoa(cnt)
		if fileExists(filepath.Join(base, result)) == false {
			break
		}
		cnt++
	}
	return result
}

func DeleteDatabase(basepath string) bool {
	if fileExists(basepath + ".params") {
		err := os.Rename(basepath+".params", basepath+".params_disabled")
		if err != nil {
			return false
		}
	}
	return true
}

func quickExec(command string, verbose bool, params ...string) error {
	cmd := exec.Command(command, params...)
	if verbose {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}
	// Make sure MMseqs2's progress bar doesn't break
	cmd.Env = append(os.Environ(), "TTY=0")

	err := cmd.Run()
	if err != nil {
		return err
	}

	return nil
}

func fileExists(file string) bool {
	_, err := os.Stat(file)
	return !os.IsNotExist(err)
}
