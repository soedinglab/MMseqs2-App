package main

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os/exec"
	"sort"
	"strconv"
	"strings"
	"time"
)

// GfaidxGraphInfo is the public, path-free description used to populate the
// frontend graph selector.
type GfaidxGraphInfo struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
}

// GfaidxRegionPath describes one coordinate track reported by
// gfaidx get_region --print_path_names.
type GfaidxRegionPath struct {
	Source    string `json:"source"`
	Reference string `json:"reference"`
	Haplotype string `json:"haplotype"`
	Sequence  string `json:"sequence"`
	Start     uint64 `json:"start"`
	End       uint64 `json:"end"`
	Entries   uint64 `json:"entries"`
	Label     string `json:"label"`
}

// gfaidxRegionPathListingTimeout keeps this synchronous metadata request short;
// graph extraction itself continues to use the queued worker timeout.
const gfaidxRegionPathListingTimeout = 30 * time.Second

// gfaidxRegionPathOutputLimit bounds metadata held in memory while leaving
// ample room for large graph path tables.
const gfaidxRegionPathOutputLimit = 64 * 1024 * 1024

// gfaidxOutputBuffer records whether command output exceeded its memory cap.
type gfaidxOutputBuffer struct {
	bytes.Buffer
	limit     int
	truncated bool
}

// Write implements io.Writer and discards data beyond the configured limit.
func (b *gfaidxOutputBuffer) Write(p []byte) (int, error) {
	originalLength := len(p)
	remaining := b.limit - b.Buffer.Len()
	if remaining <= 0 {
		b.truncated = b.truncated || originalLength > 0
		return originalLength, nil
	}
	if len(p) > remaining {
		p = p[:remaining]
		b.truncated = true
	}
	_, _ = b.Buffer.Write(p)
	return originalLength, nil
}

// publicGfaidxGraphs strips server-only paths and versions and sorts the
// database directory so API responses are stable across requests.
func publicGfaidxGraphs(graphs map[string]GfaidxGraph) []GfaidxGraphInfo {
	result := make([]GfaidxGraphInfo, 0, len(graphs))
	for _, graph := range graphs {
		result = append(result, GfaidxGraphInfo{
			ID:          graph.ID,
			Name:        graph.DisplayName,
			Description: graph.Description,
		})
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].ID < result[j].ID
	})
	return result
}

// parseGfaidxRegionPaths converts gfaidx's TSV output into the JSON shape used
// by graphviz_wasm and rejects incomplete or malformed command output.
func parseGfaidxRegionPaths(output string) ([]GfaidxRegionPath, error) {
	lines := strings.Split(output, "\n")
	headerIndex := -1
	for index, line := range lines {
		if strings.HasPrefix(line, "source\t") {
			headerIndex = index
			break
		}
	}
	if headerIndex < 0 {
		return nil, errors.New("gfaidx did not return a region path table")
	}

	reader := csv.NewReader(strings.NewReader(strings.Join(lines[headerIndex:], "\n")))
	reader.Comma = '\t'
	reader.FieldsPerRecord = -1
	header, err := reader.Read()
	if err != nil {
		return nil, errors.New("gfaidx returned an invalid region path table")
	}
	columns := make(map[string]int, len(header))
	for index, name := range header {
		columns[strings.TrimSpace(name)] = index
	}
	for _, required := range []string{"source", "reference", "haplotype", "sequence", "start", "end", "entries"} {
		if _, ok := columns[required]; !ok {
			return nil, errors.New("gfaidx returned an invalid region path table")
		}
	}

	paths := make([]GfaidxRegionPath, 0)
	for {
		record, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return nil, errors.New("gfaidx returned an invalid region path table")
		}
		if len(record) == 0 || (len(record) == 1 && strings.TrimSpace(record[0]) == "") {
			continue
		}

		// value reads one required column without trusting a short TSV row.
		value := func(name string) (string, error) {
			index := columns[name]
			if index >= len(record) {
				return "", errors.New("gfaidx returned an invalid region path table")
			}
			return strings.TrimSpace(record[index]), nil
		}

		source, err := value("source")
		if err != nil {
			return nil, err
		}
		reference, err := value("reference")
		if err != nil {
			return nil, err
		}
		haplotype, err := value("haplotype")
		if err != nil {
			return nil, err
		}
		sequence, err := value("sequence")
		if err != nil {
			return nil, err
		}
		startText, err := value("start")
		if err != nil {
			return nil, err
		}
		endText, err := value("end")
		if err != nil {
			return nil, err
		}
		entriesText, err := value("entries")
		if err != nil {
			return nil, err
		}

		start, startErr := strconv.ParseUint(startText, 10, 64)
		end, endErr := strconv.ParseUint(endText, 10, 64)
		entries, entriesErr := strconv.ParseUint(entriesText, 10, 64)
		if startErr != nil || endErr != nil || entriesErr != nil || source == "" || sequence == "" || end < start {
			return nil, errors.New("gfaidx returned an invalid region path table")
		}

		haplotypeSuffix := ""
		if haplotype != "" {
			haplotypeSuffix = " hap" + haplotype
		}
		label := strings.TrimSpace(fmt.Sprintf("%s%s %s (%d-%d)", reference, haplotypeSuffix, sequence, start, end))
		paths = append(paths, GfaidxRegionPath{
			Source:    source,
			Reference: reference,
			Haplotype: haplotype,
			Sequence:  sequence,
			Start:     start,
			End:       end,
			Entries:   entries,
			Label:     label,
		})
	}
	return paths, nil
}

// gfaidxRegionPathCommand builds the server-controlled metadata command. No
// browser-provided value is used as a path or shell fragment.
func gfaidxRegionPathCommand(graph GfaidxGraph, config ConfigGfaidx) []string {
	return []string{config.Binary, "get_region", graph.Path, "--print_path_names"}
}

// listGfaidxRegionPaths runs the small discovery command synchronously. Large
// graph extraction remains in the existing asynchronous worker queue.
func listGfaidxRegionPaths(graph GfaidxGraph, config ConfigGfaidx) ([]GfaidxRegionPath, error) {
	parameters := gfaidxRegionPathCommand(graph, config)
	cmd := exec.Command(parameters[0], parameters[1:]...)
	SetSysProcAttr(cmd)
	stdout := &gfaidxOutputBuffer{limit: gfaidxRegionPathOutputLimit}
	stderr := &limitedDiagnosticBuffer{limit: gfaidxDiagnosticLimit}
	cmd.Stdout = stdout
	cmd.Stderr = stderr

	if err := cmd.Start(); err != nil {
		return nil, &JobExecutionError{err}
	}
	done := make(chan error, 1)
	go func() {
		done <- cmd.Wait()
	}()

	timer := time.NewTimer(gfaidxRegionPathListingTimeout)
	defer timer.Stop()
	select {
	case <-timer.C:
		_ = KillCommand(cmd)
		// Reap a terminated child without holding the HTTP request indefinitely.
		select {
		case <-done:
		case <-time.After(5 * time.Second):
		}
		return nil, &JobTimeoutError{}
	case err := <-done:
		if err != nil {
			if strings.Contains(stdout.String(), "Coordinate index does not exist") ||
				strings.Contains(stderr.String(), "Coordinate index does not exist") {
				return make([]GfaidxRegionPath, 0), nil
			}
			// Prefer bounded stderr diagnostics; use only a bounded stdout prefix when stderr is empty.
			diagnostics := strings.TrimSpace(stderr.String())
			if diagnostics == "" {
				stdoutText := stdout.String()
				if len(stdoutText) > gfaidxDiagnosticLimit {
					stdoutText = stdoutText[:gfaidxDiagnosticLimit]
				}
				diagnostics = strings.TrimSpace(stdoutText)
			}
			diagnostics = strings.NewReplacer(
				config.Binary, "gfaidx",
				graph.Path, graph.ID,
			).Replace(diagnostics)
			if diagnostics == "" {
				diagnostics = "gfaidx path listing failed"
			}
			return nil, errors.New(diagnostics)
		}
		if stdout.truncated {
			return nil, errors.New("gfaidx region path table exceeded the server limit")
		}
		return parseGfaidxRegionPaths(stdout.String())
	}
}
