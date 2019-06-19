package main

import (
	"bufio"
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

func RunJob(request JobRequest, jobsystem JobSystem, config ConfigRoot) error {
	jobsystem.SetStatus(request.Id, StatusRunning)

	var cmd *exec.Cmd
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
				"easy-search",
				filepath.Join(resultBase, "job.fasta"),
				filepath.Join(config.Paths.Databases, database),
				filepath.Join(resultBase, "alis_"+database),
				filepath.Join(resultBase, "tmp"),
				"--dont-shuffle",
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

			cmd = exec.Command(
				config.Paths.Mmseqs,
				parameters...,
			)
			// Make sure MMseqs2's progress bar doesn't break
			cmd.Env = append(os.Environ(), "TTY=0")

			if config.Verbose {
				cmd.Stdout = os.Stdout
				cmd.Stderr = os.Stderr
			}

			err = cmd.Start()
			if err != nil {
				jobsystem.SetStatus(request.Id, StatusError)
				return &JobExecutionError{err}
			}

			done := make(chan error, 1)
			go func() {
				done <- cmd.Wait()
			}()

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
