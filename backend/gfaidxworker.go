package main

import (
	"bytes"
	"errors"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// gfaidxDiagnosticLimit prevents a noisy command from consuming unbounded
// memory while still retaining enough output to explain a failed query.
const gfaidxDiagnosticLimit = 16 * 1024

// limitedDiagnosticBuffer keeps only a bounded prefix of process output.
type limitedDiagnosticBuffer struct {
	bytes.Buffer
	limit int
}

// Write implements io.Writer while discarding bytes beyond the configured cap.
func (b *limitedDiagnosticBuffer) Write(p []byte) (int, error) {
	originalLength := len(p)
	remaining := b.limit - b.Buffer.Len()
	if remaining > 0 {
		if len(p) > remaining {
			p = p[:remaining]
		}
		_, _ = b.Buffer.Write(p)
	}
	return originalLength, nil
}

// validateQueuedGfaidxJob protects workers from malformed persisted or remote
// jobs even if they did not originate from the local HTTP handlers.
func validateQueuedGfaidxJob(job GfaidxJob, config ConfigGfaidx) (GfaidxGraph, error) {
	graph, err := resolveGfaidxGraph(job.GraphID, config)
	if err != nil {
		return GfaidxGraph{}, err
	}
	if graph.Version != job.GraphVersion {
		return GfaidxGraph{}, errors.New("registered graph changed after the job was submitted; submit it again")
	}
	if _, err := effectiveGfaidxThreads(job.Threads, config); err != nil {
		return GfaidxGraph{}, err
	}
	if err := validateGfaidxFlags(job.NoPaths, job.WithCoords); err != nil {
		return GfaidxGraph{}, err
	}

	switch job.Command {
	case GfaidxGetSubgraph:
		if job.AllHaplotypes || job.HaplotypeGap != "" || job.Reference != "" {
			return GfaidxGraph{}, errors.New("region-only arguments were supplied to get_subgraph")
		}
		if _, err := validateGfaidxText("start_node", job.StartNode, true); err != nil {
			return GfaidxGraph{}, err
		}
		if job.MaxNodes < 1 {
			return GfaidxGraph{}, errors.New("max_nodes must be at least 1")
		}
	case GfaidxGetRegion:
		if _, err := validateGfaidxText("sequence", job.Sequence, true); err != nil {
			return GfaidxGraph{}, err
		}
		if strings.Contains(job.Sequence, ":") {
			return GfaidxGraph{}, errors.New("sequence cannot contain a colon")
		}
		if job.End <= job.Start {
			return GfaidxGraph{}, errors.New("end must be greater than start")
		}
		if !job.AllHaplotypes && job.MaxNodes < 1 {
			return GfaidxGraph{}, errors.New("max_nodes must be at least 1 for BFS region extraction")
		}
		if job.HaplotypeGap != "" && !job.AllHaplotypes {
			return GfaidxGraph{}, errors.New("haplotype_gap requires all_haplotypes")
		}
		if job.HaplotypeGap != "" && !validHaplotypeGap.MatchString(job.HaplotypeGap) {
			return GfaidxGraph{}, errors.New("invalid haplotype_gap")
		}
	default:
		return GfaidxGraph{}, errors.New("unsupported gfaidx command")
	}
	return graph, nil
}

// gfaidxCommand builds the complete argument vector from validated fields.
// No shell is involved, and all filesystem paths come from server configuration.
func gfaidxCommand(job GfaidxJob, graph GfaidxGraph, outputPath string, config ConfigGfaidx) []string {
	parameters := []string{config.Binary, string(job.Command)}
	switch job.Command {
	case GfaidxGetSubgraph:
		parameters = append(parameters, graph.Path, job.StartNode, outputPath)
	case GfaidxGetRegion:
		region := fmt.Sprintf("%s:%d-%d", job.Sequence, job.Start, job.End)
		parameters = append(parameters, graph.Path, region, outputPath)
	}

	if job.AllHaplotypes {
		parameters = append(parameters, "--all_haplotypes")
	} else {
		parameters = append(parameters, "--max_nodes", strconv.FormatUint(job.MaxNodes, 10))
	}
	parameters = append(parameters, "--threads", strconv.Itoa(job.Threads))
	if job.Reference != "" {
		parameters = append(parameters, "--reference", job.Reference)
	}
	if job.HaplotypeGap != "" {
		parameters = append(parameters, "--haplotype_gap", job.HaplotypeGap)
	}
	if job.NoPaths {
		parameters = append(parameters, "--no_paths")
	}
	if job.WithCoords {
		parameters = append(parameters, "--with_coords")
	}
	return parameters
}

// sanitizedGfaidxError removes server filesystem paths before a command error
// is saved as the user-facing job.err response.
func sanitizedGfaidxError(output string, graph GfaidxGraph, outputPath string, config ConfigGfaidx) string {
	replacer := strings.NewReplacer(
		config.Binary, "gfaidx",
		graph.Path, graph.ID,
		outputPath, "result.gfa",
	)
	output = strings.TrimSpace(replacer.Replace(output))
	if output == "" {
		return "gfaidx query failed"
	}
	return "gfaidx query failed: " + output
}

// executeGfaidx starts one process, applies the configured timeout, and turns
// safe command diagnostics into the existing user-visible job error type.
func executeGfaidx(parameters []string, graph GfaidxGraph, outputPath string, config ConfigGfaidx, verbose bool) error {
	cmd := exec.Command(parameters[0], parameters[1:]...)
	SetSysProcAttr(cmd)
	stdout := &limitedDiagnosticBuffer{limit: gfaidxDiagnosticLimit}
	stderr := &limitedDiagnosticBuffer{limit: gfaidxDiagnosticLimit}
	cmd.Stdout = stdout
	cmd.Stderr = stderr

	if err := cmd.Start(); err != nil {
		return &JobExecutionError{err}
	}
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	timeout := time.Duration(config.TimeoutSeconds) * time.Second
	if timeout <= 0 {
		timeout = 5 * time.Minute
	}
	timer := time.NewTimer(timeout)
	defer timer.Stop()

	select {
	case <-timer.C:
		if err := KillCommand(cmd); err != nil {
			log.Printf("Failed to kill gfaidx: %s\n", err)
		}
		// Give the killed process a short opportunity to be reaped without blocking the worker indefinitely.
		select {
		case <-done:
		case <-time.After(5 * time.Second):
		}
		return &JobTimeoutError{}
	case err := <-done:
		if verbose && (stdout.Len() > 0 || stderr.Len() > 0) {
			// Verbose configurations already log other backend binaries; keep gfaidx consistent.
			logOutput := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
			if logOutput != "" {
				log.Print(logOutput)
			}
		}
		if err != nil {
			output := strings.TrimSpace(stdout.String() + "\n" + stderr.String())
			return &JobUserError{sanitizedGfaidxError(output, graph, outputPath, config)}
		}
		return nil
	}
}

// RunGfaidxJob executes one query inside its existing ticket directory and
// publishes result.gfa only after gfaidx exits successfully with non-empty data.
func RunGfaidxJob(job GfaidxJob, requestID Id, config ConfigRoot) error {
	if config.Gfaidx == nil {
		return &JobExecutionError{errors.New("gfaidx is not configured")}
	}
	graph, err := validateQueuedGfaidxJob(job, *config.Gfaidx)
	if err != nil {
		return &JobUserError{err.Error()}
	}

	resultBase := lookupJobDir(config.Paths.Results, requestID)
	temporaryPath := filepath.Join(resultBase, "result.gfa.tmp")
	resultPath := filepath.Join(resultBase, "result.gfa")
	// Remove only stale files belonging to this exact ticket before a retry.
	_ = os.Remove(temporaryPath)
	_ = os.Remove(resultPath)
	defer os.Remove(temporaryPath)

	parameters := gfaidxCommand(job, graph, temporaryPath, *config.Gfaidx)
	if err := executeGfaidx(parameters, graph, temporaryPath, *config.Gfaidx, config.Verbose); err != nil {
		return err
	}
	info, err := os.Stat(temporaryPath)
	if err != nil {
		return &JobExecutionError{errors.New("gfaidx produced no output file")}
	}
	if !info.Mode().IsRegular() || info.Size() == 0 {
		return &JobExecutionError{errors.New("gfaidx produced an empty output file")}
	}
	if err := os.Rename(temporaryPath, resultPath); err != nil {
		return &JobExecutionError{err}
	}
	return nil
}
