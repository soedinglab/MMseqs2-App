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
	"path/filepath"
	"strings"
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

func execCommand(verbose bool, parameters ...string) (*exec.Cmd, chan error, error) {
	cmd := exec.Command(
		parameters[0],
		parameters[1:]...,
	)
	// Make sure MMseqs2's progress bar doesn't break
	cmd.Env = append(os.Environ(), "TTY=0")

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

func RunJob(request JobRequest, config ConfigRoot) (err error) {
	switch job := request.Job.(type) {
	case SearchJob:
		resultBase := filepath.Join(config.Paths.Results, string(request.Id))
		for _, database := range job.Database {
			params, err := ReadParams(filepath.Join(config.Paths.Databases, database+".params"))
			if err != nil {
				return &JobExecutionError{err}
			}
			parameters := []string{
				config.Paths.Mmseqs,
				"easy-search",
				filepath.Join(resultBase, "job.fasta"),
				filepath.Join(config.Paths.Databases, database),
				filepath.Join(resultBase, "alis_"+database),
				filepath.Join(resultBase, "tmp"),
				"--shuffle",
				"0",
				"--db-output",
				"--db-load-mode",
				"2",
				"--write-lookup",
				"1",
				"--format-output",
				"query,target,pident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,qlen,tlen,qaln,taln",
			}
			parameters = append(parameters, strings.Fields(params.Display.Search)...)

			if job.Mode == "summary" {
				parameters = append(parameters, "--greedy-best-hits")
			}

			cmd, done, err := execCommand(config.Verbose, parameters...)
			if err != nil {
				return &JobExecutionError{err}
			}

			select {
			case <-time.After(1 * time.Hour):
				if err := cmd.Process.Kill(); err != nil {
					log.Printf("Failed to kill: %s\n", err)
				}
				return &JobTimeoutError{}
			case err := <-done:
				if err != nil {
					return &JobExecutionError{err}
				}
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
		if len(job.Database) != 2 {
			return &JobExecutionError{errors.New("Invalid number of databases specifed")}
		}

		resultBase := filepath.Join(config.Paths.Results, string(request.Id))

		scriptPath := filepath.Join(resultBase, "msa.sh")
		script, err := os.Create(scriptPath)
		if err != nil {
			return &JobExecutionError{err}
		}
		script.WriteString(`#!/bin/bash -e
MMSEQS="$1"
QUERY="$2"
DBBASE="$3"
BASE="$4"
DB1="$5"
DB1_PARAM="$6"
DB2="$7"
DB2_PARAM="$8"

mkdir -p "${BASE}"
"${MMSEQS}" createdb "${QUERY}" "${BASE}/qdb"
"${MMSEQS}" search "${BASE}/qdb" "${DBBASE}/${DB1}" "${BASE}/res" "${BASE}/tmp" --num-iterations 3 --db-load-mode 2 -a
"${MMSEQS}" expandaln "${BASE}/qdb" "${DBBASE}/${DB1}_seq" "${BASE}/res" "${DBBASE}/${DB1}_aln" "${BASE}/res_exp" --expansion-mode 1
"${MMSEQS}" filterresult "${BASE}/qdb" "${DBBASE}/${DB1}_seq" "${BASE}/res_exp" "${BASE}/res_filt" --diff 3000
"${MMSEQS}" result2msa "${BASE}/qdb" "${DBBASE}/${DB1}_seq" "${BASE}/res_filt" "${BASE}/${DB1}.sto" --filter-msa 0 --msa-format-mode 4
"${MMSEQS}" convertalis "${BASE}/qdb" "${DBBASE}/${DB1}_seq" "${BASE}/res_filt" "${BASE}/${DB1}.m8" --format-output query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,qseq,qaln,tseq,taln
"${MMSEQS}" result2profile "${BASE}/qdb" "${DBBASE}/${DB1}" "${BASE}/res" "${BASE}/prof_res"
"${MMSEQS}" rmdb "${BASE}/res"
"${MMSEQS}" search "${BASE}/prof_res" "${DBBASE}/${DB2}" "${BASE}/res" "${BASE}/tmp" --db-load-mode 2 -a
"${MMSEQS}" expandaln "${BASE}/prof_res" "${DBBASE}/${DB2}_seq" "${BASE}/res" "${DBBASE}/${DB2}_aln" "${BASE}/res_exp" --expansion-mode 1
"${MMSEQS}" filterresult "${BASE}/prof_res" "${DBBASE}/${DB2}_seq" "${BASE}/res_exp" "${BASE}/res_filt" --diff 3000
"${MMSEQS}" result2msa "${BASE}/prof_res" "${DBBASE}/${DB2}_seq" "${BASE}/res_filt" "${BASE}/${DB2}.sto" --filter-msa 0 --msa-format-mode 4
"${MMSEQS}" convertalis "${BASE}/prof_res" "${DBBASE}/${DB2}_seq" "${BASE}/res_filt" "${BASE}/${DB2}.m8" --format-output query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,qseq,qaln,tseq,taln
"${MMSEQS}" rmdb "${BASE}/qdb"
"${MMSEQS}" rmdb "${BASE}/qdb_h"
"${MMSEQS}" rmdb "${BASE}/res"
"${MMSEQS}" rmdb "${BASE}/res_exp"
"${MMSEQS}" rmdb "${BASE}/res_filt"
rm -f "${BASE}/prof_res"*
rm -rf "${BASE}/tmp"
`)
		err = script.Close()
		if err != nil {
			return &JobExecutionError{err}
		}

		params0, err := ReadParams(filepath.Join(config.Paths.Databases, job.Database[0]+".params"))
		if err != nil {
			return &JobExecutionError{err}
		}

		params1, err := ReadParams(filepath.Join(config.Paths.Databases, job.Database[1]+".params"))
		if err != nil {
			return &JobExecutionError{err}
		}

		parameters := []string{
			"/bin/sh",
			scriptPath,
			config.Paths.Mmseqs,
			filepath.Join(resultBase, "job.fasta"),
			config.Paths.Databases,
			resultBase,
			job.Database[0],
			params0.Display.Search,
			job.Database[1],
			params1.Display.Search,
		}

		cmd, done, err := execCommand(config.Verbose, parameters...)
		if err != nil {
			return &JobExecutionError{err}
		}

		select {
		case <-time.After(1 * time.Hour):
			if err := cmd.Process.Kill(); err != nil {
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

				if err := addFile(tw, filepath.Join(resultBase, job.Database[0]+".m8")); err != nil {
					return err
				}

				if err := addFile(tw, filepath.Join(resultBase, job.Database[0]+".sto")); err != nil {
					return err
				}

				if err := addFile(tw, filepath.Join(resultBase, job.Database[1]+".m8")); err != nil {
					return err
				}

				if err := addFile(tw, filepath.Join(resultBase, job.Database[1]+".sto")); err != nil {
					return err
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
		err = CheckDatabase(file, params.Display, config)
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
	for {
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
