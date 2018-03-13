package main

import (
	"bufio"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
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

func RunJob(job Job, ticket *Ticket, jobsystem JobSystem, config ConfigRoot) error {
	jobsystem.SetStatus(ticket.Id, StatusRunning)

	cmd := exec.Command(
		config.Paths.SearchScript,
		config.Paths.Mmseqs,
		config.Paths.Results,
		string(ticket.Id),
		config.Paths.Databases,
		strings.Join(job.Database, " "),
		job.Mode,
	)

	if config.Verbose {
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr
	}

	err := cmd.Start()
	if err != nil {
		jobsystem.SetStatus(ticket.Id, StatusError)
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
		jobsystem.SetStatus(ticket.Id, StatusError)
		return &JobTimeoutError{}
	case err := <-done:
		if err != nil {
			jobsystem.SetStatus(ticket.Id, StatusError)
			return &JobExecutionError{err}

		} else {
			if config.Verbose {
				log.Print("Process finished gracefully without error")
			}
			jobsystem.SetStatus(ticket.Id, StatusComplete)
			return nil
		}
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

		jobFile := path.Join(config.Paths.Results, string(ticket.Id), "job.json")

		f, err := os.Open(jobFile)
		if err != nil {
			jobsystem.SetStatus(ticket.Id, StatusError)
			continue
		}
		defer f.Close()

		var job Job
		dec := json.NewDecoder(bufio.NewReader(f))
		err = dec.Decode(&job)
		if err != nil {
			jobsystem.SetStatus(ticket.Id, StatusError)
			continue
		}

		err = RunJob(job, ticket, jobsystem, config)
		switch err.(type) {
		case *JobExecutionError:
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
