package main

import (
	"archive/tar"
	"bytes"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeFile(t *testing.T, path string, content string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}
}

func TestTarJobDirSkipsScratch(t *testing.T) {
	dir := t.TempDir()
	writeFile(t, filepath.Join(dir, "job.json"), "{}")
	writeFile(t, filepath.Join(dir, "alis_pdb"), "hits")
	writeFile(t, filepath.Join(dir, "pdb_pdb", "1abc.pdb"), "ATOM")
	writeFile(t, filepath.Join(dir, "tmp0", "huge"), "scratch")
	writeFile(t, filepath.Join(dir, "tmp", "nested", "huge"), "scratch")

	var buf bytes.Buffer
	if err := TarJobDir(&buf, dir); err != nil {
		t.Fatal(err)
	}

	names := map[string]bool{}
	tr := tar.NewReader(&buf)
	for {
		header, err := tr.Next()
		if err != nil {
			break
		}
		names[header.Name] = true
	}

	for _, want := range []string{"job.json", "alis_pdb", "pdb_pdb/1abc.pdb"} {
		if !names[want] {
			t.Errorf("%q missing from archive, got %v", want, names)
		}
	}
	for name := range names {
		if isScratchEntry(name, strings.HasSuffix(name, "/")) {
			t.Errorf("scratch entry %q was archived", name)
		}
	}
}

func TestIsScratchEntry(t *testing.T) {
	cases := []struct {
		name  string
		isDir bool
		want  bool
	}{
		{"tmp0", true, true},
		{"tmp0/latest/query", false, true},
		{"tmp0/latest", true, true},
		{"pdb_pdb/tmp1/x", false, true},
		{"job.json", false, false},
		{"alis_pdb", false, false},
		{"pdb_pdb/1abc.pdb", false, false},
		{"tmpresult.tsv", false, false},
		{"pdb_pdb/tmpfoo", false, false},
	}
	for _, c := range cases {
		if got := isScratchEntry(c.name, c.isDir); got != c.want {
			t.Errorf("isScratchEntry(%q, %v) = %v, want %v", c.name, c.isDir, got, c.want)
		}
	}
}

func TestTarUntarRoundTrip(t *testing.T) {
	src := t.TempDir()
	writeFile(t, filepath.Join(src, "job.json"), `{"id":"x"}`)
	writeFile(t, filepath.Join(src, "pdb_pdb", "1abc.pdb"), "ATOM 1")

	var buf bytes.Buffer
	if err := TarJobDir(&buf, src); err != nil {
		t.Fatal(err)
	}

	dst := filepath.Join(t.TempDir(), "restored")
	if err := UntarJobDir(&buf, dst); err != nil {
		t.Fatal(err)
	}

	for _, rel := range []string{"job.json", filepath.Join("pdb_pdb", "1abc.pdb")} {
		want, err := os.ReadFile(filepath.Join(src, rel))
		if err != nil {
			t.Fatal(err)
		}
		got, err := os.ReadFile(filepath.Join(dst, rel))
		if err != nil {
			t.Fatal(err)
		}
		if string(got) != string(want) {
			t.Errorf("%s = %q, want %q", rel, got, want)
		}
	}
}

func TestUntarRejectsEscapingPaths(t *testing.T) {
	for _, name := range []string{"../escaped", "/etc/passwd", "sub/../../escaped"} {
		var buf bytes.Buffer
		tw := tar.NewWriter(&buf)
		body := []byte("nope")
		if err := tw.WriteHeader(&tar.Header{Name: name, Mode: 0644, Size: int64(len(body)), Typeflag: tar.TypeReg}); err != nil {
			t.Fatal(err)
		}
		tw.Write(body)
		tw.Close()

		dst := filepath.Join(t.TempDir(), "dest")
		if err := UntarJobDir(&buf, dst); err == nil {
			t.Errorf("%q was accepted", name)
		}
	}
}

func TestMergeMoveOverwritesAndSkips(t *testing.T) {
	src := t.TempDir()
	dst := t.TempDir()

	writeFile(t, filepath.Join(src, "job.json"), "worker copy")
	writeFile(t, filepath.Join(src, "alis_pdb"), "new hits")
	writeFile(t, filepath.Join(src, "pdb_pdb", "1abc.pdb"), "new atom")

	writeFile(t, filepath.Join(dst, "job.json"), "server copy")
	writeFile(t, filepath.Join(dst, "job.pdb"), "input")
	writeFile(t, filepath.Join(dst, "alis_pdb"), "old hits")
	writeFile(t, filepath.Join(dst, "pdb_pdb", "9zzz.pdb"), "kept")

	if err := mergeMove(src, dst, map[string]bool{"job.json": true}); err != nil {
		t.Fatal(err)
	}

	checks := map[string]string{
		"job.json":         "server copy",
		"job.pdb":          "input",
		"alis_pdb":         "new hits",
		"pdb_pdb/1abc.pdb": "new atom",
		"pdb_pdb/9zzz.pdb": "kept",
	}
	for rel, want := range checks {
		got, err := os.ReadFile(filepath.Join(dst, filepath.FromSlash(rel)))
		if err != nil {
			t.Fatalf("%s: %v", rel, err)
		}
		if string(got) != want {
			t.Errorf("%s = %q, want %q", rel, got, want)
		}
	}
}
