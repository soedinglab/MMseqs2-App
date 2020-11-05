package main

import (
	"archive/tar"
	"bufio"
	"compress/gzip"
	"encoding/json"
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

func RunJob(request JobRequest, jobsystem JobSystem, config ConfigRoot) error {
	jobsystem.SetStatus(request.Id, StatusRunning)

	switch job := request.Job.(type) {
	case SearchJob:
		resultBase := filepath.Join(config.Paths.Results, string(request.Id))
		for _, database := range job.Database {
			params, err := ReadParams(filepath.Join(config.Paths.Databases, database+".params"))
			if err != nil {
				jobsystem.SetStatus(request.Id, StatusError)
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
				"--format-output",
				"query,target,pident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,qlen,tlen,qaln,taln",
			}
			parameters = append(parameters, strings.Fields(params.Display.Search)...)

			if job.Mode == "summary" {
				parameters = append(parameters, "--greedy-best-hits")
			}

			cmd, done, err := execCommand(config.Verbose, parameters...)
			if err != nil {
				jobsystem.SetStatus(request.Id, StatusError)
				return &JobExecutionError{err}
			}

			select {
			case <-time.After(1 * time.Hour):
				if err := cmd.Process.Kill(); err != nil {
					log.Printf("Failed to kill: %s\n", err)
				}
				jobsystem.SetStatus(request.Id, StatusError)
				return &JobTimeoutError{}
			case err := <-done:
				if err != nil {
					jobsystem.SetStatus(request.Id, StatusError)
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
		file.Close()
		if err != nil {
			return &JobExecutionError{err}
		}

		if config.Verbose {
			log.Print("Process finished gracefully without error")
		}
		jobsystem.SetStatus(request.Id, StatusComplete)
		return nil
	case MsaJob:
		path := filepath.Join(filepath.Clean(config.Paths.Results), string(request.Id))
		file, _ := os.Create(filepath.Join(path, "mmseqs_results_"+string(request.Id)+".tar.gz"))
		defer file.Close()
		gw := gzip.NewWriter(file)
		defer gw.Close()
		tw := tar.NewWriter(gw)
		defer tw.Close()

		resultBase := filepath.Join(config.Paths.Results, string(request.Id))
		for _, database := range job.Database {
			params, err := ReadParams(filepath.Join(config.Paths.Databases, database+".params"))
			if err != nil {
				jobsystem.SetStatus(request.Id, StatusError)
				return &JobExecutionError{err}
			}

			scriptPath := filepath.Join(resultBase, "msa.sh")
			file, err := os.Create(scriptPath)
			if err != nil {
				jobsystem.SetStatus(request.Id, StatusError)
				return &JobExecutionError{err}
			}
			file.WriteString(`#!/bin/bash -e
MMSEQS="$1"
QUERY="$2"
DB="$3"
BASE="$4"

mkdir -p "${BASE}"
"${MMSEQS}" createdb "${QUERY}" "${BASE}/qdb"
"${MMSEQS}" search "${BASE}/qdb" "${DB}" "${BASE}/res" "${BASE}/tmp" --num-iterations 3 --db-load-mode 2
"${MMSEQS}" expandaln "${BASE}/qdb" "${DB}_seq" "${BASE}/res" "${DB}_aln" "${BASE}/res_exp"
"${MMSEQS}" filterresult "${BASE}/qdb" "${DB}_seq" "${BASE}/res_exp" "${BASE}/res_filt" --diff 3000
"${MMSEQS}" result2msa "${BASE}/qdb" "${DB}_seq" "${BASE}/res_filt" "${BASE}.sto" --filter-msa 0 --msa-format-mode 4
"${MMSEQS}" convertalis "${BASE}/qdb" "${DB}_seq" "${BASE}/res_filt" "${BASE}.m8" --format-output query,target,fident,alnlen,mismatch,gapopen,qstart,qend,tstart,tend,evalue,bits,qseq,qaln,tseq,taln
"${MMSEQS}" rmdb "${BASE}/qdb"
"${MMSEQS}" rmdb "${BASE}/qdb_h"
"${MMSEQS}" rmdb "${BASE}/res"
"${MMSEQS}" rmdb "${BASE}/res_exp"
"${MMSEQS}" rmdb "${BASE}/res_filt"
rm -rf "${BASE}/tmp"
rmdir "${BASE}"
`)
			file.Close()

			dbResultBase := filepath.Join(resultBase, database)

			parameters := []string{
				"/bin/sh",
				scriptPath,
				config.Paths.Mmseqs,
				filepath.Join(resultBase, "job.fasta"),
				filepath.Join(config.Paths.Databases, database),
				dbResultBase,
			}
			parameters = append(parameters, strings.Fields(params.Display.Search)...)

			cmd, done, err := execCommand(config.Verbose, parameters...)
			if err != nil {
				jobsystem.SetStatus(request.Id, StatusError)
				return &JobExecutionError{err}
			}

			select {
			case <-time.After(1 * time.Hour):
				if err := cmd.Process.Kill(); err != nil {
					log.Printf("Failed to kill: %s\n", err)
				}
				jobsystem.SetStatus(request.Id, StatusError)
				return &JobTimeoutError{}
			case err := <-done:
				if err != nil {
					jobsystem.SetStatus(request.Id, StatusError)
					return &JobExecutionError{err}
				}

				if err := addFile(tw, dbResultBase+".m8"); err != nil {
					jobsystem.SetStatus(request.Id, StatusError)
					return &JobExecutionError{err}
				}

				if err := addFile(tw, dbResultBase+".sto"); err != nil {
					jobsystem.SetStatus(request.Id, StatusError)
					return &JobExecutionError{err}
				}
			}
		}

		if config.Verbose {
			log.Print("Process finished gracefully without error")
		}
		jobsystem.SetStatus(request.Id, StatusComplete)
		return nil
	case IndexJob:
		file := filepath.Join(config.Paths.Databases, job.Path)
		params, err := ReadParams(file + ".params")
		if err != nil {
			jobsystem.SetStatus(request.Id, StatusError)
			return &JobExecutionError{err}
		}
		params.Status = StatusRunning
		SaveParams(file+".params", params)
		jobsystem.SetStatus(request.Id, StatusRunning)
		err = CheckDatabase(file, params.Display, config)
		if err != nil {
			params.Status = StatusError
			SaveParams(file+".params", params)
			jobsystem.SetStatus(request.Id, StatusError)
			return &JobExecutionError{err}
		} else {
			if config.Verbose {
				log.Println("Process finished gracefully without error")
			}
			params.Status = StatusComplete
			SaveParams(file+".params", params)
			jobsystem.SetStatus(request.Id, StatusComplete)
			return nil
		}
	default:
		jobsystem.SetStatus(request.Id, StatusError)
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
			continue
		}
		defer f.Close()

		var job JobRequest
		dec := json.NewDecoder(bufio.NewReader(f))
		err = dec.Decode(&job)
		if err != nil {
			jobsystem.SetStatus(ticket.Id, StatusError)
			continue
		}

		err = RunJob(job, jobsystem, config)
		switch err.(type) {
		case *JobExecutionError, *JobInvalidError:
			log.Print(err)
			if job.Email != "" {
				err = mailer.Send(Mail{
					config.Mail.Sender,
					job.Email,
					fmt.Sprintf(config.Mail.Templates.Error.Subject, string(ticket.Id)),
					fmt.Sprintf(config.Mail.Templates.Error.Body, string(ticket.Id)),
				})
				if err != nil {
					log.Print(err)
				}
			}
		case *JobTimeoutError:
			log.Print(err)
			if job.Email != "" {
				err = mailer.Send(Mail{
					config.Mail.Sender,
					job.Email,
					fmt.Sprintf(config.Mail.Templates.Timeout.Subject, string(ticket.Id)),
					fmt.Sprintf(config.Mail.Templates.Timeout.Body, string(ticket.Id)),
				})
				if err != nil {
					log.Print(err)
				}
			}
		case nil:
			if job.Email != "" {
				err = mailer.Send(Mail{
					config.Mail.Sender,
					job.Email,
					fmt.Sprintf(config.Mail.Templates.Success.Subject, string(ticket.Id)),
					fmt.Sprintf(config.Mail.Templates.Success.Body, string(ticket.Id)),
				})
				if err != nil {
					fmt.Printf("%s", err)
				}
			}
		}
	}
}
