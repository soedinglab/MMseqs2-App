package main

import (
	"archive/tar"
	"bufio"
	"compress/gzip"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"time"
)

type JobExecutionError struct {
	internal error
}

func (e *JobExecutionError) Error() string {
	return "Execution Error: " + e.internal.Error()
}

type JobTimeoutError struct {
}

func (e *JobTimeoutError) Error() string {
	return "Timeout"
}

type JobInvalidError struct {
}

func (e *JobInvalidError) Error() string {
	return "Invalid"
}

func gpuParameters(config *GpuConfig) ([]string, []string) {
	parameters := []string{}
	environ := []string{}
	if config != nil && config.UseGpu {
		parameters = append(parameters, "--gpu")
		parameters = append(parameters, "1")

		if config.UseServer {
			parameters = append(parameters, "--gpu-server")
			parameters = append(parameters, "1")
		}

		if config.Devices != "" {
			environ = append(environ, "CUDA_VISIBLE_DEVICES="+config.Devices)
		} else {
			// respect original CUDA_VISIBLE_DEVICES if we don't override it
			for _, kv := range os.Environ() {
				if strings.HasPrefix(kv, "CUDA_VISIBLE_DEVICES=") {
					environ = append(environ, kv)
					break
				}
			}
		}
	}
	return parameters, environ
}

func execCommand(verbose bool, parameters []string, environ []string) (*exec.Cmd, chan error, error) {
	cmd := exec.Command(
		parameters[0],
		parameters[1:]...,
	)

	SetSysProcAttr(cmd)

	baseEnv := os.Environ()
	// Save original CUDA_VISIBLE_DEVICES
	filtered := make([]string, 0, len(baseEnv))
	for _, kv := range baseEnv {
		if strings.HasPrefix(kv, "CUDA_VISIBLE_DEVICES=") {
			filtered = append(filtered, "ORIG_"+kv)
		} else {
			filtered = append(filtered, kv)
		}
	}
	// Make sure MMseqs2's progress bar doesn't break
	cmd.Env = append(filtered, "TTY=0", "MMSEQS_CALL_DEPTH=1")
	cmd.Env = append(cmd.Env, environ...)

	if verbose {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}

	done := make(chan error, 1)
	err := cmd.Start()
	if err != nil {
		return cmd, done, err
	}

	go func() {
		done <- cmd.Wait()
	}()

	return cmd, done, err
}

const maxDuration time.Duration = 1<<63 - 1

func execCommandSync(verbose bool, parameters []string, environ []string, timeout time.Duration) error {
	cmd, done, err := execCommand(verbose, parameters, environ)
	if err != nil {
		return err
	}
	select {
	case <-time.After(timeout):
		if err := KillCommand(cmd); err != nil {
			log.Printf("Failed to kill: %s\n", err)
		}
		return &JobTimeoutError{}
	case err := <-done:
		if err != nil {
			return err
		}
		return nil
	}
}

var fasta3DiInput = regexp.MustCompile(`^>.*?\n.*?\n>3DI.*?\n.*?\n`).MatchString

func ismmCIFFile(filePath string) (bool, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return false, err
	}
	defer file.Close()

	firstLine := ""
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		firstLine = strings.TrimSpace(scanner.Text())
		if firstLine != "" {
			break
		}
	}

	if err := scanner.Err(); err != nil {
		return false, err
	}
	if firstLine == "" {
		return false, errors.New("empty file")
	}

	if strings.HasPrefix(firstLine, "#") || strings.HasPrefix(firstLine, "data_") {
		return true, nil
	}
	return false, nil
}

func RunJob(request JobRequest, config ConfigRoot) (err error) {
	switch job := request.Job.(type) {
	case SearchJob:
		resultBase := filepath.Join(config.Paths.Results, string(request.Id))
		var wg sync.WaitGroup
		errChan := make(chan error, len(job.Database))
		maxParallel := config.Worker.ParallelDatabases
		semaphore := make(chan struct{}, max(1, maxParallel))

		for index, database := range job.Database {
			wg.Add(1)
			semaphore <- struct{}{}
			go func(index int, database string) {
				defer wg.Done()
				defer func() { <-semaphore }()
				params, err := ReadParams(filepath.Join(config.Paths.Databases, database+".params"))
				if err != nil {
					errChan <- &JobExecutionError{err}
					return
				}
				columns := "query,"
				if params.FullHeader {
					columns += "theader"
				} else {
					columns += "target"
				}
				columns += ",pident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,qlen,tlen,qaln,taln"
				if params.Taxonomy {
					columns += ",taxid,taxname"
				}
				parameters := []string{
					config.Paths.Mmseqs,
					"easy-search",
					filepath.Join(resultBase, "job.fasta"),
					filepath.Join(config.Paths.Databases, database),
					filepath.Join(resultBase, "alis_"+database),
					filepath.Join(resultBase, "tmp"+strconv.Itoa(index)),
					"--shuffle",
					"0",
					"--db-output",
					"--db-load-mode",
					"2",
					"--write-lookup",
					"1",
					"--format-output",
					columns,
				}
				parameters = append(parameters, strings.Fields(params.Search)...)

				if job.Mode == "summary" {
					parameters = append(parameters, "--greedy-best-hits")
				}

				if params.Taxonomy && job.TaxFilter != "" {
					parameters = append(parameters, "--taxon-list")
					parameters = append(parameters, job.TaxFilter)
				}

				gpupar, environ := gpuParameters(params.GpuConfig)
				parameters = append(parameters, gpupar...)

				cmd, done, err := execCommand(config.Verbose, parameters, environ)
				if err != nil {
					errChan <- &JobExecutionError{err}
					return
				}

				select {
				case <-time.After(1 * time.Hour):
					if err := KillCommand(cmd); err != nil {
						log.Printf("Failed to kill: %s\n", err)
					}
					errChan <- &JobTimeoutError{}
				case err := <-done:
					if err != nil {
						errChan <- &JobExecutionError{err}
					} else {
						errChan <- nil
					}
				}
			}(index, database)
		}

		wg.Wait()
		close(errChan)

		for err := range errChan {
			if err != nil {
				return &JobExecutionError{err}
			}
		}

		err = execCommandSync(
			config.Verbose,
			[]string{
				config.Paths.Mmseqs,
				"mvdb",
				filepath.Join(resultBase, "tmp0", "latest", "query_h"),
				filepath.Join(resultBase, "query_h"),
			},
			[]string{},
			1*time.Minute,
		)
		if err != nil {
			return &JobExecutionError{err}
		}
		err = execCommandSync(
			config.Verbose,
			[]string{
				config.Paths.Mmseqs,
				"mvdb",
				filepath.Join(resultBase, "tmp0", "latest", "query"),
				filepath.Join(resultBase, "query"),
			},
			[]string{},
			1*time.Minute,
		)
		if err != nil {
			return &JobExecutionError{err}
		}
		for index, _ := range job.Database {
			err := os.RemoveAll(filepath.Join(resultBase, "tmp"+strconv.Itoa(index)))
			if err != nil {
				return &JobExecutionError{err}
			}
		}

		path := filepath.Join(filepath.Clean(config.Paths.Results), string(request.Id))
		file, err := os.Create(filepath.Join(path, "mmseqs_results_"+string(request.Id)+".tar.gz"))
		if err != nil {
			return &JobExecutionError{err}
		}
		err = ResultArchive(file, request.Id, path)
		if err != nil {
			file.Close()
			return &JobExecutionError{err}
		}
		err = file.Close()
		if err != nil {
			return &JobExecutionError{err}
		}

		if config.Verbose {
			log.Print("Process finished gracefully without error")
		}
		return nil
	case StructureSearchJob:
		resultBase := filepath.Join(config.Paths.Results, string(request.Id))
		var wg sync.WaitGroup
		errChan := make(chan error, len(job.Database))
		maxParallel := config.Worker.ParallelDatabases
		semaphore := make(chan struct{}, max(1, maxParallel))

		inputFile := filepath.Join(resultBase, "job.pdb")
		input, err := os.ReadFile(inputFile)
		if err != nil {
			return &JobExecutionError{err}
		}

		is3Di := false
		if fasta3DiInput(string(input)) {
			os.Rename(inputFile, filepath.Join(resultBase, "job.3di"))
			inputFile = filepath.Join(resultBase, "query")
			is3Di = true
			scriptPath := filepath.Join(resultBase, "fasta2db.sh")
			script, err := os.Create(scriptPath)
			if err != nil {
				return &JobExecutionError{err}
			}
			script.WriteString(`#!/bin/bash -e
MMSEQS="$1"
QUERY="$2"
BASE="$3"
$MMSEQS base:createdb "${QUERY}" "${BASE}/query" --shuffle 0 --dbtype 1
awk -v out="${BASE}/query" 'BEGIN { printf("") > (out"_aa.index"); printf("") > (out"_ss.index"); } NR % 2 == 1 { print $0 >> (out"_aa.index"); next } { $1 = $1 - 1; print $0 >> (out"_ss.index") }' "${BASE}/query.index"
mv -f -- "${BASE}/query_aa.index" "${BASE}/query.index"
ln -s -- "${BASE}/query" "${BASE}/query_ss"
ln -s -- "${BASE}/query.dbtype" "${BASE}/query_ss.dbtype"
awk 'NR % 2 == 1 { print $0; }' "${BASE}/query_h.index" > "${BASE}/query_h.index_tmp"
mv -f -- "${BASE}/query_h.index_tmp" "${BASE}/query_h.index"
$MMSEQS lndb "${BASE}/query_h" "${BASE}/query_ss_h"
awk 'NR % 2 == 1 { print $0; }' "${BASE}/query.lookup" > "${BASE}/query.lookup_tmp"
mv -f -- "${BASE}/query.lookup_tmp" "${BASE}/query.lookup"
`)
			err = script.Close()
			if err != nil {
				return &JobExecutionError{err}
			}

			parameters := []string{
				"/bin/sh",
				scriptPath,
				config.Paths.Foldseek,
				filepath.Join(resultBase, "job.3di"),
				resultBase,
			}
			err = execCommandSync(
				config.Verbose,
				parameters,
				[]string{},
				1*time.Minute,
			)
			if err != nil {
				return &JobExecutionError{err}
			}
		} else {
			isCif, err := ismmCIFFile(inputFile)
			if err != nil {
				return &JobExecutionError{err}
			}
			if isCif {
				newFilePath := filepath.Join(resultBase, "job.cif")
				if err := os.Rename(inputFile, newFilePath); err != nil {
					return &JobExecutionError{err}
				}
				inputFile = newFilePath
			}
		}

		for index, database := range job.Database {
			wg.Add(1)
			semaphore <- struct{}{}
			go func(index int, database string) {
				defer wg.Done()
				defer func() { <-semaphore }()

				params, err := ReadParams(filepath.Join(config.Paths.Databases, database+".params"))
				if err != nil {
					errChan <- &JobExecutionError{err}
					return
				}

				allowedModes := []string{"3di", "tmalign", "3diaa", "lolalign"}
				allowedTags := []string{"print3di"}

				modeStr, tags, err := ParseMode(job.Mode, allowedModes, allowedTags)
				if err != nil {
					errChan <- &JobExecutionError{errors.New("invalid mode selected: " + err.Error())}
					return
				}

				var mode2num = map[string]string{"3di": "0", "tmalign": "1", "3diaa": "2", "lolalign": "3"}
				mode, found := mode2num[modeStr]
				if !found {
					errChan <- &JobExecutionError{errors.New("invalid mode selected: " + modeStr)}
					return
				}

				// overwrite tmalign mode with 3diaa if 3di input
				if is3Di && (mode == "1" || mode == "3") {
					mode = "2"
				}

				columns := "query,"
				if params.FullHeader {
					columns += "theader"
				} else {
					columns += "target"
				}
				columns += ",pident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend"
				if is3Di {
					columns += ",empty"
				} else {
					columns += ",prob"
				}
				columns += ",evalue,bits,qlen,tlen,qaln,taln,tca,tseq"
				if params.Taxonomy {
					columns += ",taxid,taxname"
				}
				if isIn("print3di", tags) != -1 {
					if !params.Taxonomy {
						columns += ",empty,empty"
					}
					columns += ",q3di,t3di"
				}
				parameters := []string{
					config.Paths.Foldseek,
					"easy-search",
					inputFile,
					filepath.Join(config.Paths.Databases, database),
					filepath.Join(resultBase, "alis_"+database),
					filepath.Join(resultBase, "tmp"+strconv.Itoa(index)),
					// "--shuffle",
					// "0",
					"--chain-name-mode",
					"1",
					"--alignment-type",
					mode,
					"--db-output",
					"--db-load-mode",
					"2",
					"--write-lookup",
					"1",
					"--format-output",
					columns,
				}
				parameters = append(parameters, strings.Fields(params.Search)...)

				if job.Mode == "summary" {
					parameters = append(parameters, "--greedy-best-hits")
				}

				if params.Taxonomy {
					parameters = append(parameters, "--report-mode")
					parameters = append(parameters, "3")
				}

				if params.Taxonomy && job.TaxFilter != "" {
					parameters = append(parameters, "--taxon-list")
					parameters = append(parameters, job.TaxFilter)
				}

				if is3Di {
					parameters = append(parameters, "--sort-by-structure-bits")
					parameters = append(parameters, "0")
				}

				if job.IterativeSearch {
					parameters = append(parameters, "--num-iterations")
					parameters = append(parameters, "0")
				}

				gpupar, environ := gpuParameters(params.GpuConfig)
				parameters = append(parameters, gpupar...)

				cmd, done, err := execCommand(config.Verbose, parameters, environ)
				if err != nil {
					errChan <- &JobExecutionError{err}
					return
				}

				select {
				case <-time.After(1 * time.Hour):
					if err := KillCommand(cmd); err != nil {
						log.Printf("Failed to kill: %s\n", err)
					}
					errChan <- &JobTimeoutError{}
				case err := <-done:
					if err != nil {
						errChan <- &JobExecutionError{err}
					} else {
						errChan <- nil
					}
				}
			}(index, database)
		}

		wg.Wait()
		close(errChan)

		for err := range errChan {
			if err != nil {
				return &JobExecutionError{err}
			}
		}

		if !is3Di {
			err = execCommandSync(
				config.Verbose,
				[]string{
					config.Paths.Foldseek,
					"mvdb",
					filepath.Join(resultBase, "tmp0", "latest", "query_h"),
					filepath.Join(resultBase, "query_h"),
				},
				[]string{},
				1*time.Minute,
			)
			if err != nil {
				return &JobExecutionError{err}
			}
			err = execCommandSync(
				config.Verbose,
				[]string{
					config.Paths.Foldseek,
					"mvdb",
					filepath.Join(resultBase, "tmp0", "latest", "query"),
					filepath.Join(resultBase, "query"),
				},
				[]string{},
				1*time.Minute,
			)
			if err != nil {
				return &JobExecutionError{err}
			}
		}
		for index, _ := range job.Database {
			err := os.RemoveAll(filepath.Join(resultBase, "tmp"+strconv.Itoa(index)))
			if err != nil {
				return &JobExecutionError{err}
			}
		}

		path := filepath.Join(filepath.Clean(config.Paths.Results), string(request.Id))
		file, err := os.Create(filepath.Join(path, "mmseqs_results_"+string(request.Id)+".tar.gz"))
		if err != nil {
			return &JobExecutionError{err}
		}
		err = ResultArchive(file, request.Id, path)
		if err != nil {
			file.Close()
			return &JobExecutionError{err}
		}
		err = file.Close()
		if err != nil {
			return &JobExecutionError{err}
		}

		if config.Verbose {
			log.Print("Process finished gracefully without error")
		}
		return nil
	case ComplexSearchJob:
		resultBase := filepath.Join(config.Paths.Results, string(request.Id))
		var wg sync.WaitGroup
		errChan := make(chan error, len(job.Database))
		maxParallel := config.Worker.ParallelDatabases
		semaphore := make(chan struct{}, max(1, maxParallel))

		inputFile := filepath.Join(resultBase, "job.pdb")

		isCif, err := ismmCIFFile(inputFile)
		if err != nil {
			return &JobExecutionError{err}
		}
		if isCif {
			newFilePath := filepath.Join(resultBase, "job.cif")
			if err := os.Rename(inputFile, newFilePath); err != nil {
				return &JobExecutionError{err}
			}
			inputFile = newFilePath
		}

		for index, database := range job.Database {
			wg.Add(1)
			semaphore <- struct{}{}
			go func(index int, database string) {
				defer wg.Done()
				defer func() { <-semaphore }()

				params, err := ReadParams(filepath.Join(config.Paths.Databases, database+".params"))
				if err != nil {
					errChan <- &JobExecutionError{err}
					return
				}

				if !params.Complex {
					err := errors.New("database is not a complex database")
					errChan <- &JobExecutionError{err}
					return
				}

				var mode2num = map[string]string{"3di": "0", "tmalign": "1", "3diaa": "2", "lolalign": "3"}
				mode, found := mode2num[job.Mode]
				if !found {
					errChan <- &JobExecutionError{errors.New("invalid mode selected")}
					return
				}

				columns := "query,"
				if params.FullHeader {
					columns += "theader"
				} else {
					columns += "target"
				}
				columns += ",pident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,prob,evalue,bits,qlen,tlen,qaln,taln,tca,tseq"
				columns += ",complexassignid,complexqtmscore,complexttmscore,complexu,complext"
				if params.Taxonomy {
					columns += ",taxid,taxname"
				}
				parameters := []string{
					config.Paths.Foldseek,
					"easy-complexsearch",
					inputFile,
					filepath.Join(config.Paths.Databases, database),
					filepath.Join(resultBase, "alis_"+database),
					filepath.Join(resultBase, "tmp"+strconv.Itoa(index)),
					// "--shuffle",
					// "0",
					"--chain-name-mode",
					"1",
					"--alignment-type",
					mode,
					"--db-output",
					"--db-load-mode",
					"2",
					"--write-lookup",
					"1",
					"--format-output",
					columns,
					"--complex-report-mode",
					"0",
				}

				par := params.Search
				if params.Multimer != "" {
					par = params.Multimer
				}

				parameters = append(parameters, strings.Fields(par)...)

				if job.Mode == "summary" {
					parameters = append(parameters, "--greedy-best-hits")
				}

				if params.Taxonomy && job.TaxFilter != "" {
					parameters = append(parameters, "--taxon-list")
					parameters = append(parameters, job.TaxFilter)
				}

				cmd, done, err := execCommand(config.Verbose, parameters, []string{})
				if err != nil {
					errChan <- &JobExecutionError{err}
					return
				}

				select {
				case <-time.After(1 * time.Hour):
					if err := KillCommand(cmd); err != nil {
						log.Printf("Failed to kill: %s\n", err)
					}
					errChan <- &JobTimeoutError{}
				case err := <-done:
					if err != nil {
						errChan <- &JobExecutionError{err}
					} else {
						errChan <- nil
					}
				}
			}(index, database)
		}

		wg.Wait()
		close(errChan)

		for err := range errChan {
			if err != nil {
				return &JobExecutionError{err}
			}
		}

		err = execCommandSync(
			config.Verbose,
			[]string{
				config.Paths.Foldseek,
				"mvdb",
				filepath.Join(resultBase, "tmp0", "latest", "query_h"),
				filepath.Join(resultBase, "query_h"),
			},
			[]string{},
			1*time.Minute,
		)
		if err != nil {
			return &JobExecutionError{err}
		}
		err = execCommandSync(
			config.Verbose,
			[]string{
				config.Paths.Foldseek,
				"mvdb",
				filepath.Join(resultBase, "tmp0", "latest", "query"),
				filepath.Join(resultBase, "query"),
			},
			[]string{},
			1*time.Minute,
		)
		if err != nil {
			return &JobExecutionError{err}
		}
		for index, _ := range job.Database {
			err := os.RemoveAll(filepath.Join(resultBase, "tmp"+strconv.Itoa(index)))
			if err != nil {
				return &JobExecutionError{err}
			}
		}

		path := filepath.Join(filepath.Clean(config.Paths.Results), string(request.Id))
		file, err := os.Create(filepath.Join(path, "mmseqs_results_"+string(request.Id)+".tar.gz"))
		if err != nil {
			return &JobExecutionError{err}
		}
		err = ResultArchive(file, request.Id, path)
		if err != nil {
			file.Close()
			return &JobExecutionError{err}
		}
		err = file.Close()
		if err != nil {
			return &JobExecutionError{err}
		}

		if config.Verbose {
			log.Print("Process finished gracefully without error")
		}
		return nil
	case MsaJob:
		resultBase := filepath.Join(config.Paths.Results, string(request.Id))

		scriptPath := filepath.Join(resultBase, "msa.sh")
		script, err := os.Create(scriptPath)
		if err != nil {
			return &JobExecutionError{err}
		}
		if config.App == AppPredictProtein {
			script.WriteString(`#!/bin/bash -e
MMSEQS="$1"
QUERY="$2"
DBBASE="$3"
BASE="$4"
DB1="$5"
DB2="$6"
mkdir -p "${BASE}"
"${MMSEQS}" createdb "${QUERY}" "${BASE}/qdb"
"${MMSEQS}" search "${BASE}/qdb" "${DBBASE}/${DB1}" "${BASE}/res" "${BASE}/tmp" --num-iterations 3 --db-load-mode 2 -a
"${MMSEQS}" mvdb "${BASE}/tmp/latest/profile_1" "${BASE}/prof_res"
"${MMSEQS}" lndb "${BASE}/qdb_h" "${BASE}/prof_res_h"
"${MMSEQS}" expandaln "${BASE}/qdb" "${DBBASE}/${DB1}.idx" "${BASE}/res" "${DBBASE}/${DB1}.idx" "${BASE}/res_exp" --expansion-mode 1 --db-load-mode 2
"${MMSEQS}" filterresult "${BASE}/qdb" "${DBBASE}/${DB1}.idx" "${BASE}/res_exp" "${BASE}/res_filt" --diff 3000 --db-load-mode 2
"${MMSEQS}" result2msa "${BASE}/qdb" "${DBBASE}/${DB1}.idx" "${BASE}/res_filt" "${BASE}/uniref.sto" --filter-msa 0 --msa-format-mode 4 --db-load-mode 2
"${MMSEQS}" convertalis "${BASE}/qdb" "${DBBASE}/${DB1}.idx" "${BASE}/res_filt" "${BASE}/uniref.m8" --format-output query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,qseq,qaln,tseq,taln --db-load-mode 2
"${MMSEQS}" rmdb "${BASE}/res"
"${MMSEQS}" search "${BASE}/prof_res" "${DBBASE}/${DB2}" "${BASE}/res" "${BASE}/tmp" --db-load-mode 2 -a
"${MMSEQS}" result2msa "${BASE}/qdb" "${DBBASE}/${DB2}.idx" "${BASE}/res" "${BASE}/pdb70.sto" --filter-msa 0 --msa-format-mode 4 --db-load-mode 2
"${MMSEQS}" convertalis "${BASE}/qdb" "${DBBASE}/${DB2}.idx" "${BASE}/res" "${BASE}/pdb70.m8" --format-output query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,qseq,qaln,tseq,taln --db-load-mode 2
"${MMSEQS}" rmdb "${BASE}/qdb"
"${MMSEQS}" rmdb "${BASE}/qdb_h"
"${MMSEQS}" rmdb "${BASE}/res"
"${MMSEQS}" rmdb "${BASE}/res_exp"
"${MMSEQS}" rmdb "${BASE}/res_filt"
rm -f "${BASE}/prof_res"*
rm -rf "${BASE}/tmp"
`)
		} else {
			parallel := config.Paths.ColabFold.ParallelStages
			script.WriteString(`#!/bin/bash -e
MMSEQS="$1"
QUERY="$2"
BASE="$4"
DB1="$5"
DB2="$6"
DB3="$7"
USE_ENV="$8"
USE_TEMPLATES="$9"
FILTER="${10}"
TAXONOMY="${11}"
M8OUT="${12}"
GPU="${13}"
GPUSERVER="${14}"
EXPAND_EVAL=inf
ALIGN_EVAL=10
DIFF=3000
QSC=-20.0
MAX_ACCEPT=1000000
if [ "${FILTER}" = "1" ]; then
# 0.1 was not used in benchmarks due to POSIX shell bug in line above
#  EXPAND_EVAL=0.1
  ALIGN_EVAL=10
  QSC=0.8
  MAX_ACCEPT=100000
fi
export MMSEQS_CALL_DEPTH=1
SEARCH_PARAM="--num-iterations 3 --db-load-mode 2 -a --k-score 'seq:96,prof:80' -e 0.1 --max-seqs 10000"
if [ "${GPU}" = "1" ]; then
  GPU_PARAM="--gpu 1 --prefilter-mode 1"
fi
if [ "${GPUSERVER}" = "1" ]; then
  GPU_PARAM="${GPU_PARAM} --gpu-server 1"
fi
if [ "${GPU_PARAM}" != "" ]; then
	SEARCH_PARAM="${SEARCH_PARAM} ${GPU_PARAM}"
fi
FILTER_PARAM="--filter-min-enable 1000 --diff ${DIFF} --qid 0.0,0.2,0.4,0.6,0.8,1.0 --qsc 0 --max-seq-id 0.95"
EXPAND_PARAM="--expansion-mode 0 -e ${EXPAND_EVAL} --expand-filter-clusters ${FILTER} --max-seq-id 0.95"
mkdir -p "${BASE}"
"${MMSEQS}" createdb "${QUERY}" "${BASE}/qdb" --dbtype 1
if [ -n "${ORIG_CUDA_VISIBLE_DEVICES}" ]; then
	export CUDA_VISIBLE_DEVICES="${ORIG_CUDA_VISIBLE_DEVICES}"
fi
if [ -n "$UNIREF_CUDA_VISIBLE_DEVICES" ]; then
  export CUDA_VISIBLE_DEVICES="${UNIREF_CUDA_VISIBLE_DEVICES}"
fi
"${MMSEQS}" search "${BASE}/qdb" "${DB1}" "${BASE}/res" "${BASE}/tmp1" $SEARCH_PARAM
"${MMSEQS}" mvdb "${BASE}/tmp1/latest/profile_1" "${BASE}/prof_res"
"${MMSEQS}" lndb "${BASE}/qdb_h" "${BASE}/prof_res_h"
`)
			if parallel {
				script.WriteString("\n(\n")
			}
			script.WriteString(`
"${MMSEQS}" expandaln "${BASE}/qdb" "${DB1}.idx" "${BASE}/res" "${DB1}.idx" "${BASE}/res_exp" --db-load-mode 2 ${EXPAND_PARAM}
"${MMSEQS}" align "${BASE}/prof_res" "${DB1}.idx" "${BASE}/res_exp" "${BASE}/res_exp_realign" --db-load-mode 2 -e ${ALIGN_EVAL} --max-accept ${MAX_ACCEPT} --alt-ali 10 -a
"${MMSEQS}" filterresult "${BASE}/qdb" "${DB1}.idx" "${BASE}/res_exp_realign" "${BASE}/res_exp_realign_filter" --db-load-mode 2 --qid 0 --qsc $QSC --diff 0 --max-seq-id 1.0 --filter-min-enable 100
if [ "${M8OUT}" = "1" ]; then
  "${MMSEQS}" filterresult "${BASE}/qdb" "${DB1}.idx" "${BASE}/res_exp_realign_filter" "${BASE}/res_exp_realign_filter_filter" --db-load-mode 2 ${FILTER_PARAM}
  "${MMSEQS}" convertalis "${BASE}/qdb" "${DB1}.idx" "${BASE}/res_exp_realign_filter_filter" "${BASE}/uniref.m8" --db-load-mode 2 --format-output query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,tseq
  "${MMSEQS}" rmdb "${BASE}/res_exp_realign_filter_filter"
else
  "${MMSEQS}" result2msa "${BASE}/qdb" "${DB1}.idx" "${BASE}/res_exp_realign_filter" "${BASE}/uniref.a3m" --msa-format-mode 6 --db-load-mode 2 --filter-msa ${FILTER} ${FILTER_PARAM}
fi
"${MMSEQS}" rmdb "${BASE}/res_exp_realign"
"${MMSEQS}" rmdb "${BASE}/res_exp"
"${MMSEQS}" rmdb "${BASE}/res"
if [ "${TAXONOMY}" = "1" ] && [ -e "${DB1}_taxonomy" ]; then
  "${MMSEQS}" convertalis "${BASE}/qdb" "${DB1}.idx" "${BASE}/res_exp_realign_filter" "${BASE}/res_exp_realign_tax" --db-output 1 --format-output "taxid,target,taxlineage" --db-load-mode 2
  awk 'BEGIN { printf("%c%c%c%c",8,0,0,0); exit; }' > "${BASE}/res_exp_realign_tax.dbtype"
  MMSEQS_FORCE_MERGE=1 "${MMSEQS}" filtertaxdb "${DB1}" "${BASE}/res_exp_realign_tax" "${BASE}/res_exp_realign_tax_filt" --taxon-list '!12908&&!28384'
  tr -d '\000' < "${BASE}/res_exp_realign_tax_filt" | sort -u > "${BASE}/uniref_tax.tsv"
fi
"${MMSEQS}" rmdb "${BASE}/res_exp_realign_filter"
`)
			if parallel {
				script.WriteString("\n)&\n(\n")
			}
			script.WriteString(`
if [ "${USE_TEMPLATES}" = "1" ]; then
  if [ -n "${ORIG_CUDA_VISIBLE_DEVICES}" ]; then
    export CUDA_VISIBLE_DEVICES="${ORIG_CUDA_VISIBLE_DEVICES}"
  fi
  if [ -n "${PDB_CUDA_VISIBLE_DEVICES}" ]; then
    export CUDA_VISIBLE_DEVICES="${PDB_CUDA_VISIBLE_DEVICES}"
  fi
  "${MMSEQS}" search "${BASE}/prof_res" "${DB2}" "${BASE}/res_pdb" "${BASE}/tmp2" --db-load-mode 2 -s 7.5 -a -e 0.1 ${GPU_PARAM}
  "${MMSEQS}" convertalis "${BASE}/prof_res" "${DB2}.idx" "${BASE}/res_pdb" "${BASE}/pdb70.m8" --format-output query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,cigar --db-load-mode 2
  "${MMSEQS}" rmdb "${BASE}/res_pdb"
fi
`)
			if parallel {
				script.WriteString("\n)&\n(\n")
			}
			script.WriteString(`
if [ "${USE_ENV}" = "1" ]; then
  if [ -n "${ORIG_CUDA_VISIBLE_DEVICES}" ]; then
    export CUDA_VISIBLE_DEVICES="${ORIG_CUDA_VISIBLE_DEVICES}"
  fi
  if [ -n "${ENV_CUDA_VISIBLE_DEVICES}" ]; then
    export CUDA_VISIBLE_DEVICES="${ENV_CUDA_VISIBLE_DEVICES}"
  fi
  "${MMSEQS}" search "${BASE}/prof_res" "${DB3}" "${BASE}/res_env" "${BASE}/tmp3" $SEARCH_PARAM
  "${MMSEQS}" expandaln "${BASE}/prof_res" "${DB3}.idx" "${BASE}/res_env" "${DB3}.idx" "${BASE}/res_env_exp" -e ${EXPAND_EVAL} --expansion-mode 0 --db-load-mode 2
  "${MMSEQS}" align "${BASE}/tmp3/latest/profile_1" "${DB3}.idx" "${BASE}/res_env_exp" "${BASE}/res_env_exp_realign" --db-load-mode 2 -e ${ALIGN_EVAL} --max-accept ${MAX_ACCEPT} --alt-ali 10 -a
  "${MMSEQS}" filterresult "${BASE}/qdb" "${DB3}.idx" "${BASE}/res_env_exp_realign" "${BASE}/res_env_exp_realign_filter" --db-load-mode 2 --qid 0 --qsc $QSC --diff 0 --max-seq-id 1.0 --filter-min-enable 100
  if [ "${M8OUT}" = "1" ]; then
    "${MMSEQS}" filterresult "${BASE}/qdb" "${DB3}.idx" "${BASE}/res_env_exp_realign_filter" "${BASE}/res_env_exp_realign_filter_filter" --db-load-mode 2 ${FILTER_PARAM}
    "${MMSEQS}" convertalis "${BASE}/qdb" "${DB3}.idx" "${BASE}/res_env_exp_realign_filter_filter" "${BASE}/bfd.mgnify30.metaeuk30.smag30.m8" --db-load-mode 2 --format-output query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,tseq
    "${MMSEQS}" rmdb "${BASE}/res_env_exp_realign_filter_filter"
  else
	"${MMSEQS}" result2msa "${BASE}/qdb" "${DB3}.idx" "${BASE}/res_env_exp_realign_filter" "${BASE}/bfd.mgnify30.metaeuk30.smag30.a3m" --msa-format-mode 6 --db-load-mode 2 --filter-msa ${FILTER} ${FILTER_PARAM}
  fi
  "${MMSEQS}" rmdb "${BASE}/res_env_exp_realign_filter"
  "${MMSEQS}" rmdb "${BASE}/res_env_exp_realign"
  "${MMSEQS}" rmdb "${BASE}/res_env_exp"
  "${MMSEQS}" rmdb "${BASE}/res_env"
fi
`)
			if parallel {
				script.WriteString("\n)&\nwait\n")
			}
			script.WriteString(`
"${MMSEQS}" rmdb "${BASE}/qdb"
"${MMSEQS}" rmdb "${BASE}/qdb_h"
"${MMSEQS}" rmdb "${BASE}/res"
rm -f -- "${BASE}/prof_res"*
rm -rf -- "${BASE}/tmp1" "${BASE}/tmp2" "${BASE}/tmp3"
`)
		}
		err = script.Close()
		if err != nil {
			return &JobExecutionError{err}
		}

		modes := strings.Split(job.Mode, "-")
		useEnv := isIn("env", modes) != -1
		useTemplates := isIn("notemplates", modes) == -1
		useFilter := isIn("nofilter", modes) == -1
		taxonomy := isIn("taxonomy", modes) == 1
		m8out := isIn("m8output", modes) == 1
		var b2i = map[bool]int{false: 0, true: 1}

		gpuEnabled := "0"
		gpuServerEnabled := "0"
		if config.Paths.ColabFold.Gpu != nil {
			gpuEnabled = strconv.Itoa(b2i[config.Paths.ColabFold.Gpu.UseGpu])
			gpuServerEnabled = strconv.Itoa(b2i[config.Paths.ColabFold.Gpu.UseServer])
		}

		parameters := []string{
			"/bin/sh",
			scriptPath,
			config.Paths.Mmseqs,
			filepath.Join(resultBase, "job.fasta"),
			"",
			resultBase,
			config.Paths.ColabFold.Uniref,
			config.Paths.ColabFold.Pdb,
			config.Paths.ColabFold.Environmental,
			strconv.Itoa(b2i[useEnv]),
			strconv.Itoa(b2i[useTemplates]),
			strconv.Itoa(b2i[useFilter]),
			strconv.Itoa(b2i[taxonomy]),
			strconv.Itoa(b2i[m8out]),
			gpuEnabled,
			gpuServerEnabled,
		}

		environ := []string{}
		if config.Paths.ColabFold.Gpu != nil {
			unirefDevices := config.Paths.ColabFold.Gpu.Devices
			if config.Paths.ColabFold.Gpu.UnirefDevices != "" {
				unirefDevices = config.Paths.ColabFold.Gpu.UnirefDevices
			}
			if unirefDevices != "" {
				environ = append(environ, "UNIREF_CUDA_VISIBLE_DEVICES="+unirefDevices)
			}
			pdbDevices := config.Paths.ColabFold.Gpu.Devices
			if config.Paths.ColabFold.Gpu.PdbDevices != "" {
				pdbDevices = config.Paths.ColabFold.Gpu.PdbDevices
			}
			if pdbDevices != "" {
				environ = append(environ, "PDB_CUDA_VISIBLE_DEVICES="+pdbDevices)
			}
			envDevices := config.Paths.ColabFold.Gpu.Devices
			if config.Paths.ColabFold.Gpu.EnvironmentalDevices != "" {
				envDevices = config.Paths.ColabFold.Gpu.EnvironmentalDevices
			}
			if envDevices != "" {
				environ = append(environ, "ENV_CUDA_VISIBLE_DEVICES="+envDevices)
			}
		}

		cmd, done, err := execCommand(config.Verbose, parameters, environ)
		if err != nil {
			return &JobExecutionError{err}
		}

		select {
		case <-time.After(1 * time.Hour):
			if err := KillCommand(cmd); err != nil {
				log.Printf("Failed to kill: %s\n", err)
			}
			return &JobTimeoutError{}
		case err := <-done:
			if err != nil {
				return &JobExecutionError{err}
			}

			path := filepath.Join(filepath.Clean(config.Paths.Results), string(request.Id))
			file, err := os.Create(filepath.Join(path, "mmseqs_results_"+string(request.Id)+".tar.gz"))
			if err != nil {
				return &JobExecutionError{err}
			}

			err = func() (err error) {
				gw := gzip.NewWriter(file)
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

				if config.App == AppPredictProtein {
					if err := addFile(tw, filepath.Join(resultBase, "uniref.sto")); err != nil {
						return err
					}

					if err := addFile(tw, filepath.Join(resultBase, "uniref.m8")); err != nil {
						return err
					}

					if err := addFile(tw, filepath.Join(resultBase, "pdb70.sto")); err != nil {
						return err
					}

					if err := addFile(tw, filepath.Join(resultBase, "pdb70.m8")); err != nil {
						return err
					}
				} else {
					suffix := ".a3m"
					if m8out {
						suffix = ".m8"
					}

					path := filepath.Join(resultBase, "uniref"+suffix)
					if err := addFile(tw, path); err != nil {
						return err
					}
					os.Remove(path)

					if taxonomy {
						path = filepath.Join(resultBase, "uniref_tax.tsv")
						if err := addFile(tw, path); err != nil {
							return err
						}
						os.Remove(path)
					}

					if useTemplates {
						path = filepath.Join(resultBase, "pdb70.m8")
						if err := addFile(tw, path); err != nil {
							return err
						}
						os.Remove(path)
					}

					if useEnv {
						path = filepath.Join(resultBase, "bfd.mgnify30.metaeuk30.smag30"+suffix)
						if err := addFile(tw, path); err != nil {
							return err
						}
						os.Remove(path)
					}

					if err := addFile(tw, scriptPath); err != nil {
						return err
					}
					os.Remove(scriptPath)
				}

				return nil
			}()

			if err != nil {
				file.Close()
				return &JobExecutionError{err}
			}

			if err = file.Sync(); err != nil {
				file.Close()
				return &JobExecutionError{err}
			}

			if err = file.Close(); err != nil {
				return &JobExecutionError{err}
			}
		}

		if config.Verbose {
			log.Print("Process finished gracefully without error")
		}
		return nil
	case PairJob:
		resultBase := filepath.Join(config.Paths.Results, string(request.Id))

		scriptPath := filepath.Join(resultBase, "pair.sh")
		script, err := os.Create(scriptPath)
		if err != nil {
			return &JobExecutionError{err}
		}
		script.WriteString(`#!/bin/bash -e
MMSEQS="$1"
QUERY="$2"
BASE="$4"
DB1="$5"
DB2="$6"
USE_ENV="$7"
USE_PAIRWISE="$8"
PAIRING_STRATEGY="$9"
PAIRING_FILTER="${10}"
PAIRING_FILTER_PROX="${11}"
GPU="${12}"
GPUSERVER="${13}"
SEARCH_PARAM="--num-iterations 3 --db-load-mode 2 -a --k-score 'seq:96,prof:80' -e 0.1 --max-seqs 10000"
EXPAND_PARAM="--expansion-mode 0 -e inf --expand-filter-clusters 0 --max-seq-id 0.95"
if [ "${GPU}" = "1" ]; then
  SEARCH_PARAM="${SEARCH_PARAM} --gpu 1 --prefilter-mode 1"
fi
if [ "${GPUSERVER}" = "1" ]; then
  SEARCH_PARAM="${SEARCH_PARAM} --gpu-server 1"
fi
export MMSEQS_CALL_DEPTH=1
"${MMSEQS}" createdb "${QUERY}" "${BASE}/qdb" --shuffle 0 --dbtype 1
unset CUDA_VISIBLE_DEVICES
if [ -n "$UNIREF_CUDA_VISIBLE_DEVICES" ]; then
  export CUDA_VISIBLE_DEVICES="${UNIREF_CUDA_VISIBLE_DEVICES}"
fi
"${MMSEQS}" search "${BASE}/qdb" "${DB1}" "${BASE}/res" "${BASE}/tmp" $SEARCH_PARAM
"${MMSEQS}" mvdb "${BASE}/tmp/latest/profile_1" "${BASE}/prof_res"
"${MMSEQS}" lndb "${BASE}/qdb_h" "${BASE}/prof_res_h"
if [ "${USE_PAIRWISE}" = "1" ]; then
    for i in qdb res qdb_h; do
		awk 'BEGIN { OFS="\t"; cnt = 0; } NR == 1 { off = $2; len = $3; next; } { print (2*cnt),off,len; print (2*cnt)+1,$2,$3; cnt+=1; }' "${BASE}/${i}.index" > "${BASE}/${i}.index_tmp"
		mv -f -- "${BASE}/${i}.index_tmp" "${BASE}/${i}.index"
	done
	# write a new qdb.lookup to enable pairwise pairing
	awk 'BEGIN { OFS="\t"; cnt = 0; } NR == 1 { off = $2; len = $3; next; } { print (2*cnt),off,cnt; print (2*cnt)+1,$2,cnt; cnt+=1; }' "${BASE}/qdb.lookup" > "${BASE}/qdb.lookup_tmp"
	mv -f -- "${BASE}/qdb.lookup_tmp" "${BASE}/qdb.lookup"
fi
"${MMSEQS}" expandaln "${BASE}/qdb" "${DB1}.idx" "${BASE}/res" "${DB1}.idx" "${BASE}/res_exp" --db-load-mode 2 ${EXPAND_PARAM}
"${MMSEQS}" align   "${BASE}/prof_res" "${DB1}.idx" "${BASE}/res_exp" "${BASE}/res_exp_realign" --db-load-mode 2 -e 0.001 --max-accept 1000000
"${MMSEQS}" pairaln "${BASE}/qdb" "${DB1}.idx" "${BASE}/res_exp_realign" "${BASE}/res_exp_realign_pair" --db-load-mode 2 --pairing-mode "${PAIRING_STRATEGY}" --pairing-filter "${PAIRING_FILTER}" --pairing-prox-dist "${PAIRING_FILTER_PROX}" --pairing-dummy-mode 0
"${MMSEQS}" align   "${BASE}/prof_res" "${DB1}.idx" "${BASE}/res_exp_realign_pair" "${BASE}/res_exp_realign_pair_bt" --db-load-mode 2 -e inf -a
"${MMSEQS}" pairaln "${BASE}/qdb" "${DB1}.idx" "${BASE}/res_exp_realign_pair_bt" "${BASE}/res_final" --db-load-mode 2 --pairing-mode "${PAIRING_STRATEGY}" --pairing-filter "${PAIRING_FILTER}" --pairing-prox-dist "${PAIRING_FILTER_PROX}" --pairing-dummy-mode 1
"${MMSEQS}" result2msa "${BASE}/qdb" "${DB1}.idx" "${BASE}/res_final" "${BASE}/pair.a3m" --db-load-mode 2 --msa-format-mode 6

"${MMSEQS}" rmdb "${BASE}/res"
"${MMSEQS}" rmdb "${BASE}/res_exp"
"${MMSEQS}" rmdb "${BASE}/res_exp_realign"
"${MMSEQS}" rmdb "${BASE}/res_exp_realign_pair"
"${MMSEQS}" rmdb "${BASE}/res_exp_realign_pair_bt"
"${MMSEQS}" rmdb "${BASE}/res_final"
"${MMSEQS}" rmdb "${BASE}/prof_res"
"${MMSEQS}" rmdb "${BASE}/prof_res_h"


if [ "${USE_ENV}" = "1" ]; then
	unset CUDA_VISIBLE_DEVICES
	if [ -n "${ENV_CUDA_VISIBLE_DEVICES}" ]; then
		export CUDA_VISIBLE_DEVICES="${ENV_CUDA_VISIBLE_DEVICES}"
	fi
	"${MMSEQS}" search "${BASE}/qdb" "${DB2}" "${BASE}/res" "${BASE}/tmp" $SEARCH_PARAM
	"${MMSEQS}" mvdb "${BASE}/tmp/latest/profile_1" "${BASE}/prof_res"
    "${MMSEQS}" lndb "${BASE}/qdb_h" "${BASE}/prof_res_h"
	"${MMSEQS}" expandaln "${BASE}/qdb" "${DB2}.idx" "${BASE}/res" "${DB2}.idx" "${BASE}/res_exp" --db-load-mode 2 ${EXPAND_PARAM}
	"${MMSEQS}" align   "${BASE}/prof_res" "${DB2}.idx" "${BASE}/res_exp" "${BASE}/res_exp_realign" --db-load-mode 2 -e 0.001 --max-accept 1000000 -c 0.5 --cov-mode 1
	"${MMSEQS}" pairaln "${BASE}/qdb" "${DB2}.idx" "${BASE}/res_exp_realign" "${BASE}/res_exp_realign_pair" --db-load-mode 2 --pairing-mode "${PAIRING_STRATEGY}" --pairing-filter 0 --pairing-dummy-mode 0
	"${MMSEQS}" align   "${BASE}/prof_res" "${DB2}.idx" "${BASE}/res_exp_realign_pair" "${BASE}/res_exp_realign_pair_bt" --db-load-mode 2 -e inf -a
	"${MMSEQS}" pairaln "${BASE}/qdb" "${DB2}.idx" "${BASE}/res_exp_realign_pair_bt" "${BASE}/res_final" --db-load-mode 2 --pairing-mode "${PAIRING_STRATEGY}" --pairing-filter 0 --pairing-dummy-mode 1
	"${MMSEQS}" result2msa "${BASE}/qdb" "${DB2}.idx" "${BASE}/res_final" "${BASE}/pair.env.a3m" --db-load-mode 2 --msa-format-mode 5
	cat "${BASE}/pair.a3m" "${BASE}/pair.env.a3m" > "${BASE}/pair.a3m_tmp"
	mv -f -- "${BASE}/pair.a3m_tmp" "${BASE}/pair.a3m"
fi

"${MMSEQS}" rmdb "${BASE}/res"
"${MMSEQS}" rmdb "${BASE}/res_exp"
"${MMSEQS}" rmdb "${BASE}/res_exp_realign"
"${MMSEQS}" rmdb "${BASE}/res_exp_realign_pair"
"${MMSEQS}" rmdb "${BASE}/res_exp_realign_pair_bt"
"${MMSEQS}" rmdb "${BASE}/res_final"
"${MMSEQS}" rmdb "${BASE}/prof_res"
"${MMSEQS}" rmdb "${BASE}/prof_res_h"
"${MMSEQS}" rmdb "${BASE}/qdb"
"${MMSEQS}" rmdb "${BASE}/qdb_h"

rm -rf -- "${BASE}/tmp"
`)
		err = script.Close()
		if err != nil {
			return &JobExecutionError{err}
		}
		modes := strings.Split(job.Mode, "-")
		useEnv := isIn("env", modes) != -1
		usePairwise := isIn("pairwise", modes) != -1
		var b2i = map[bool]int{false: 0, true: 1}

		pairGreedy := isIn("pairgreedy", modes) != -1
		pairComplete := isIn("paircomplete", modes) != -1

		if pairGreedy && pairComplete {
			return &JobInvalidError{}
		}

		pairingStrategy := "0"
		if pairGreedy {
			pairingStrategy = "0"
		} else if pairComplete {
			pairingStrategy = "1"
		}

		pairFilterBest := isIn("pairfilterbest", modes) != -1
		pairFilterProx := false
		pairFilterProxThreshold := "20"
		for _, mode := range modes {
			if mode == "pairfilterprox" {
				pairFilterProx = true
				break
			}
			// set distance through "pairfilterprox" parameter
			if strings.HasPrefix(mode, "pairfilterprox_") {
				parts := strings.SplitN(mode, "_", 2)
				if len(parts) == 2 && parts[1] != "" {
					pairFilterProx = true
					pairFilterProxThreshold = parts[1]
					break
				}
			}
		}

		if pairFilterBest && pairFilterProx {
			return &JobInvalidError{}
		}

		pairFilter := "0"
		if pairFilterBest {
			pairFilter = "0"
		} else if pairFilterProx {
			pairFilter = "1"
		}

		gpuEnabled := "0"
		gpuServerEnabled := "0"
		if config.Paths.ColabFold.Gpu != nil {
			gpuEnabled = strconv.Itoa(b2i[config.Paths.ColabFold.Gpu.UseGpu])
			gpuServerEnabled = strconv.Itoa(b2i[config.Paths.ColabFold.Gpu.UseServer])
		}

		parameters := []string{
			"/bin/sh",
			scriptPath,
			config.Paths.Mmseqs,
			filepath.Join(resultBase, "job.fasta"),
			"",
			resultBase,
			config.Paths.ColabFold.Uniref,
			config.Paths.ColabFold.EnvironmentalPair,
			strconv.Itoa(b2i[useEnv]),
			strconv.Itoa(b2i[usePairwise]),
			pairingStrategy,
			pairFilter,
			pairFilterProxThreshold,
			gpuEnabled,
			gpuServerEnabled,
		}

		environ := []string{}
		if config.Paths.ColabFold.Gpu != nil {
			unirefDevices := config.Paths.ColabFold.Gpu.Devices
			if config.Paths.ColabFold.Gpu.UnirefDevices != "" {
				unirefDevices = config.Paths.ColabFold.Gpu.UnirefDevices
			}
			if unirefDevices != "" {
				environ = append(environ, "UNIREF_CUDA_VISIBLE_DEVICES="+unirefDevices)
			}
			envDevices := config.Paths.ColabFold.Gpu.Devices
			if config.Paths.ColabFold.Gpu.EnvironmentalDevices != "" {
				envDevices = config.Paths.ColabFold.Gpu.EnvironmentalDevices
			}
			if envDevices != "" {
				environ = append(environ, "ENV_CUDA_VISIBLE_DEVICES="+envDevices)
			}
		}

		cmd, done, err := execCommand(config.Verbose, parameters, environ)
		if err != nil {
			return &JobExecutionError{err}
		}

		select {
		case <-time.After(1 * time.Hour):
			if err := KillCommand(cmd); err != nil {
				log.Printf("Failed to kill: %s\n", err)
			}
			return &JobTimeoutError{}
		case err := <-done:
			if err != nil {
				return &JobExecutionError{err}
			}

			path := filepath.Join(filepath.Clean(config.Paths.Results), string(request.Id))
			file, err := os.Create(filepath.Join(path, "mmseqs_results_"+string(request.Id)+".tar.gz"))
			if err != nil {
				return &JobExecutionError{err}
			}

			err = func() (err error) {
				gw := gzip.NewWriter(file)
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

				path := filepath.Join(resultBase, "pair.a3m")
				if err := addFile(tw, path); err != nil {
					return err
				}
				os.Remove(path)

				path = filepath.Join(resultBase, "pair.sh")
				if err := addFile(tw, path); err != nil {
					return err
				}
				os.Remove(path)

				return nil
			}()

			if err != nil {
				file.Close()
				return &JobExecutionError{err}
			}

			if err = file.Sync(); err != nil {
				file.Close()
				return &JobExecutionError{err}
			}

			if err = file.Close(); err != nil {
				return &JobExecutionError{err}
			}
		}
		if config.Verbose {
			log.Print("Process finished gracefully without error")
		}
		return nil
	case IndexJob:
		file := filepath.Join(config.Paths.Databases, job.Path)
		params, err := ReadParams(file + ".params")
		if err != nil {
			return &JobExecutionError{err}
		}
		params.Status = StatusRunning
		err = SaveParams(file+".params", params)
		if err != nil {
			return &JobExecutionError{err}
		}
		err = CheckDatabase(file, params, config)
		if err != nil {
			params.Status = StatusError
			SaveParams(file+".params", params)
			return &JobExecutionError{err}
		}
		if config.Verbose {
			log.Println("Process finished gracefully without error")
		}
		params.Status = StatusComplete
		err = SaveParams(file+".params", params)
		if err != nil {
			return &JobExecutionError{err}
		}
		return nil
	case FoldMasonMSAJob:
		resultBase := filepath.Join(config.Paths.Results, string(request.Id))
		parameters := []string{
			config.Paths.FoldMason,
			"easy-msa",
			filepath.Join(resultBase, "pdbs/"),
			filepath.Join(resultBase, "foldmason"),
			filepath.Join(resultBase, "tmp/"),
			"--gap-open",
			strconv.FormatInt(job.GapOpen, 10),
			"--gap-extend",
			strconv.FormatInt(job.GapExtend, 10),
			"--report-mode",
			"2",
			"--report-paths",
			"0",
		}
		cmd, done, err := execCommand(config.Verbose, parameters, []string{})
		if err != nil {
			return &JobExecutionError{err}
		}
		select {
		case <-time.After(1 * time.Hour):
			if err := KillCommand(cmd); err != nil {
				log.Printf("Failed to kill: %s\n", err)
			}
			return &JobTimeoutError{}
		case err := <-done:
			if err != nil {
				return &JobExecutionError{err}
			}
		}
		if config.Verbose {
			log.Print("Process finished gracefully without error")
		}
		return nil
	case FoldDiscoJob:
		log.Print(config.Paths.FoldDisco)
		resultBase := filepath.Join(config.Paths.Results, string(request.Id))
		var wg sync.WaitGroup
		errChan := make(chan error, len(job.Database))
		maxParallel := config.Worker.ParallelDatabases
		semaphore := make(chan struct{}, max(1, maxParallel))

		inputFile := filepath.Join(resultBase, "job.pdb")

		isCif, err := ismmCIFFile(inputFile)
		if err != nil {
			return &JobExecutionError{err}
		}

		if isCif {
			newFilePath := filepath.Join(resultBase, "job.cif")
			if err := os.Rename(inputFile, newFilePath); err != nil {
				return &JobExecutionError{err}
			}
			inputFile = newFilePath
		}

		motif := job.Motif

		for index, database := range job.Database {
			wg.Add(1)
			semaphore <- struct{}{}
			go func(index int, database string) {
				defer wg.Done()
				defer func() { <-semaphore }()
				params, err := ReadParams(filepath.Join(config.Paths.Databases, database+".params"))
				if err != nil {
					errChan <- &JobExecutionError{err}
					return
				}
				if !params.Motif {
					err := errors.New("database is not a folddisco database")
					errChan <- &JobExecutionError{err}
					return
				}

				parameters := []string{
					config.Paths.FoldDisco,
					"query",
					"-p",
					inputFile,
					"-q", motif,
					"-i",
					filepath.Join(config.Paths.Databases, database),
					"-o",
					filepath.Join(resultBase, "alis_"+database),
					"--top", "1000",
					"--superpose",
					"-t", "16",
				}

				cmd, done, err := execCommand(config.Verbose, parameters, []string{})
				if err != nil {
					errChan <- &JobExecutionError{err}
					return
				}

				select {
				case <-time.After(1 * time.Hour):
					if err := KillCommand(cmd); err != nil {
						log.Printf("Failed to kill: %s\n", err)
					}
					errChan <- &JobTimeoutError{}
				case err := <-done:
					if err != nil {
						errChan <- &JobExecutionError{err}
					} else {
						if params.FullHeader || params.Taxonomy {
							foldseekDb := strings.Replace(database, "_folddisco", "", 1)
							if fileExists(filepath.Join(config.Paths.Databases, foldseekDb+".dbtype")) {
								columns := "bits"
								if params.FullHeader {
									columns += ",theader"
								} else {
									columns += ",empty"
								}
								if params.Taxonomy {
									columns += ",taxid,taxname"
								}
								// make fake foldseek dbs so we can call convertalis for description and taxonomy
								parameters = []string{
									"awk",
									"-v",
									"db=" + filepath.Join(resultBase, "alis_"+database+"_db"),
									`BEGIN { printf("") > db; printf("") > db"_seq"; printf("") > db"_seq_h"; }
!($9 in f) { entry = $9"\t"$9"\t0.00\t0\t0\t0\t0\t0\t0\t0\t0"; print(entry) >> db; len += length(entry) + 1; f[$9] = 1; }
END { printf("%c", 0) >> db; printf("%c", 0) >> db"_seq"; printf("%c", 0) >> db"_seq_h";
print "0\t0\t"(len + 1) > db".index"; print "0\t0\t0" > db"_seq.index"; print "0\t0\t0" > db"_seq_h.index";
printf("%c%c%c%c",5,0,0,0) > db".dbtype"; printf("%c%c%c%c",0,0,0,0) > db"_seq.dbtype"; printf("%c%c%c%c",11,0,0,0) > db"_seq_h.dbtype"
}`,
									filepath.Join(resultBase, "alis_"+database),
								}
								err = execCommandSync(
									config.Verbose,
									parameters,
									[]string{},
									1*time.Minute,
								)
								if err != nil {
									errChan <- &JobExecutionError{err}
									return
								}
								err = execCommandSync(
									config.Verbose,
									[]string{
										config.Paths.Foldseek,
										"convertalis",
										filepath.Join(resultBase, "alis_"+database+"_db_seq"),
										filepath.Join(config.Paths.Databases, foldseekDb),
										filepath.Join(resultBase, "alis_"+database+"_db"),
										filepath.Join(resultBase, "alis_"+database+".tsv"),
										"--format-output",
										columns,
										"--db-load-mode",
										"2",
										"--db-output",
										"0",
									},
									[]string{},
									1*time.Minute,
								)
								if err != nil {
									errChan <- &JobExecutionError{err}
									return
								}
								if params.Taxonomy {
									err = execCommandSync(
										config.Verbose,
										[]string{
											config.Paths.Foldseek,
											"taxonomyreport",
											filepath.Join(config.Paths.Databases, foldseekDb),
											filepath.Join(resultBase, "alis_"+database+"_db"),
											filepath.Join(resultBase, "alis_"+database+"_report"),
											"--report-mode",
											"3",
										},
										[]string{},
										1*time.Minute,
									)
									if err != nil {
										errChan <- &JobExecutionError{err}
										return
									}
								}
							}
						}

						errChan <- nil
					}
				}
			}(index, database)
		}

		wg.Wait()
		close(errChan)

		for err := range errChan {
			if err != nil {
				return &JobExecutionError{err}
			}
		}

		path := filepath.Join(filepath.Clean(config.Paths.Results), string(request.Id))
		file, err := os.Create(filepath.Join(path, "folddisco_results_"+string(request.Id)+".tar.gz"))
		if err != nil {
			return &JobExecutionError{err}
		}
		err = ResultFolddiscoArchive(file, request.Id, path, job.Database)
		if err != nil {
			file.Close()
			return &JobExecutionError{err}
		}
		err = file.Close()
		if err != nil {
			return &JobExecutionError{err}
		}

		if config.Verbose {
			log.Print("Process finished gracefully without error")
		}
		return nil
	default:
		return &JobInvalidError{}
	}
}

func worker(jobsystem JobSystem, config ConfigRoot) {
	log.Println("MMseqs2 worker")
	mailer := MailTransport(NullTransport{})
	if config.Mail.Mailer != nil {
		log.Println("Using " + config.Mail.Mailer.Type + " mail transport")
		mailer = config.Mail.Mailer.GetTransport()
	}

	var shouldExit int32 = 0
	if config.Worker.GracefulExit {
		go func() {
			sig := make(chan os.Signal, 1)
			signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
			defer signal.Stop(sig)
			<-sig
			atomic.StoreInt32(&shouldExit, 1)
		}()
	}

	if config.App == AppMMseqs2 || config.App == AppFoldseek {
		go func() {
			hasIncomplete := false
			for hasIncomplete == true {
				databases, err := Databases(config.Paths.Databases, false)
				if err != nil {
					panic(err)
				}

				for _, db := range databases {
					if db.Status != StatusComplete {
						hasIncomplete = true
						continue
					}
				}

				time.Sleep(100 * time.Millisecond)
			}

			databases, err := Databases(config.Paths.Databases, false)
			if err != nil {
				panic(err)
			}
			for _, db := range databases {
				if db.GpuConfig != nil && db.GpuConfig.UseServer {
					go func(p Params) {
						executable := config.Paths.Mmseqs
						if config.App == AppFoldseek {
							executable = config.Paths.Foldseek
						}
						parameters := []string{
							executable,
							"gpuserver",
							filepath.Join(config.Paths.Databases, p.Path),
							"--db-load-mode",
							"0",
						}
						searchParams := strings.Fields(p.Search)
						for i := 0; i < len(searchParams); i++ {
							if searchParams[i] == "--max-seqs" && i+1 < len(searchParams) {
								parameters = append(parameters, searchParams[i], searchParams[i+1])
							}
						}
						_, environ := gpuParameters(p.GpuConfig)
						execCommandSync(
							config.Verbose,
							parameters,
							environ,
							maxDuration,
						)
					}(db)
				}
			}
		}()
	} else if config.App == AppColabFold {
		if config.Paths.ColabFold.Gpu != nil && config.Paths.ColabFold.Gpu.UseGpu && config.Paths.ColabFold.Gpu.UseServer {
			startserver := func(db string, deviceOverride string, maxSeqs string) {
				parameters := []string{
					config.Paths.Mmseqs,
					"gpuserver",
					db + ".idx",
					"--db-load-mode",
					"0",
					"--max-seqs",
					maxSeqs,
				}

				environ := []string{}
				if deviceOverride != "" {
					environ = append(environ, "CUDA_VISIBLE_DEVICES="+deviceOverride)
				} else if config.Paths.ColabFold.Gpu.Devices != "" {
					environ = append(environ, "CUDA_VISIBLE_DEVICES="+config.Paths.ColabFold.Gpu.Devices)
				} else {
					// respect original CUDA_VISIBLE_DEVICES if we don't override it
					for _, kv := range os.Environ() {
						if strings.HasPrefix(kv, "CUDA_VISIBLE_DEVICES=") {
							environ = append(environ, kv)
							break
						}
					}
				}
				execCommandSync(
					config.Verbose,
					parameters,
					environ,
					maxDuration,
				)
			}
			go startserver(config.Paths.ColabFold.Uniref, config.Paths.ColabFold.Gpu.UnirefDevices, "10000")
			if config.Paths.ColabFold.Pdb != "" {
				go startserver(config.Paths.ColabFold.Pdb, config.Paths.ColabFold.Gpu.PdbDevices, "300")
			}
			if config.Paths.ColabFold.Environmental != "" {
				go startserver(config.Paths.ColabFold.Environmental, config.Paths.ColabFold.Gpu.EnvironmentalDevices, "10000")
			}
		}
	}

	for {
		if config.Worker.GracefulExit && atomic.LoadInt32(&shouldExit) == 1 {
			return
		}
		ticket, err := jobsystem.Dequeue()
		if err != nil {
			if ticket != nil {
				log.Print(err)
			}
			time.Sleep(100 * time.Millisecond)
			continue
		}

		if ticket == nil && err == nil {
			time.Sleep(100 * time.Millisecond)
			continue
		}

		jobFile := filepath.Join(config.Paths.Results, string(ticket.Id), "job.json")

		f, err := os.Open(jobFile)
		if err != nil {
			jobsystem.SetStatus(ticket.Id, StatusError)
			log.Print(err)
			continue
		}

		var job JobRequest
		dec := json.NewDecoder(bufio.NewReader(f))
		err = dec.Decode(&job)
		f.Close()
		if err != nil {
			jobsystem.SetStatus(ticket.Id, StatusError)
			log.Print(err)
			continue
		}

		jobsystem.SetStatus(ticket.Id, StatusRunning)
		err = RunJob(job, config)
		mailTemplate := config.Mail.Templates.Success
		switch err.(type) {
		case *JobExecutionError, *JobInvalidError:
			jobsystem.SetStatus(ticket.Id, StatusError)
			log.Print(err)
			mailTemplate = config.Mail.Templates.Error
		case *JobTimeoutError:
			jobsystem.SetStatus(ticket.Id, StatusError)
			log.Print(err)
			mailTemplate = config.Mail.Templates.Timeout
		case nil:
			jobsystem.SetStatus(ticket.Id, StatusComplete)
		}
		if job.Email != "" {
			err = mailer.Send(Mail{
				config.Mail.Sender,
				job.Email,
				fmt.Sprintf(mailTemplate.Subject, string(ticket.Id)),
				fmt.Sprintf(mailTemplate.Body, string(ticket.Id)),
			})
			if err != nil {
				log.Print(err)
			}
		}
	}
}
