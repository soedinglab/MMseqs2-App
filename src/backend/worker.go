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
				"--db-output",
				"--no-preload",
				"--early-exit",
				"--format-mode",
				"2",
			}
			parameters = append(parameters, strings.Fields(params.Display.Search)...)

			if job.Mode == "summary" {
				parameters = append(parameters, "--greedy-best-hits")
			}

			cmd = exec.Command(
				config.Paths.Mmseqs,
				parameters...,
			)

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
		sens, err := params.Display.Sensitiviy()
		if err != nil {
			params.Status = StatusError
			SaveParams(file+".params", params)
			jobsystem.SetStatus(request.Id, StatusError)
			return &JobExecutionError{err}
		}
		params.Status = StatusRunning
		SaveParams(file+".params", params)
		err = CheckDatabase(file, config.Paths.Temporary, config.Paths.Mmseqs, sens, config.Verbose)
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
	log.Println("MMseqs2 Worker")
	log.Println("Using " + config.Mail.Transport + " Mail Transport")
	mailer := Factory(config.Mail.Transport)
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
			if job.Email != "" {
				err := mailer.Send(Mail{
					config.Mail.Sender,
					job.Email,
					fmt.Sprintf(config.Mail.Templates.Error.Subject, ticket),
					fmt.Sprintf(config.Mail.Templates.Error.Body, ticket),
				})
				if err != nil {
					fmt.Printf("%s", err)
				}
			}
		case *JobTimeoutError:
			if job.Email != "" {
				err := mailer.Send(Mail{
					config.Mail.Sender,
					job.Email,
					fmt.Sprintf(config.Mail.Templates.Timeout.Subject, ticket),
					fmt.Sprintf(config.Mail.Templates.Timeout.Body, ticket),
				})
				if err != nil {
					fmt.Printf("%s", err)
				}
			}
		case nil:
			if job.Email != "" {
				err := mailer.Send(Mail{
					config.Mail.Sender,
					job.Email,
					fmt.Sprintf(config.Mail.Templates.Success.Subject, ticket),
					fmt.Sprintf(config.Mail.Templates.Success.Body, ticket),
				})
				if err != nil {
					fmt.Printf("%s", err)
				}
			}
		}
	}
}
