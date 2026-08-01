package main

import (
	"archive/tar"
	"errors"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

func isScratchEntry(name string, isDir bool) bool {
	dir := path.Clean(filepath.ToSlash(name))
	if !isDir {
		dir = path.Dir(dir)
	}
	for dir != "." && dir != "/" && dir != "" {
		if strings.HasPrefix(path.Base(dir), "tmp") {
			return true
		}
		parent := path.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}
	return false
}

func TarJobDir(w io.Writer, dir string) error {
	tw := tar.NewWriter(w)
	root := filepath.Clean(dir)

	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		rel, err := filepath.Rel(root, path)
		if err != nil {
			return err
		}
		if rel == "." {
			return nil
		}
		if isScratchEntry(rel, info.IsDir()) {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		if !info.Mode().IsRegular() && !info.IsDir() {
			return nil
		}

		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = filepath.ToSlash(rel)
		if info.IsDir() {
			header.Name += "/"
		}
		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}

		f, err := os.Open(path)
		if err != nil {
			return err
		}
		_, err = io.Copy(tw, f)
		f.Close()
		return err
	})
	if err != nil {
		tw.Close()
		return err
	}

	return tw.Close()
}

// Refuses anything that would escape dir
func safeJoin(dir string, name string) (string, error) {
	if filepath.IsAbs(name) || strings.HasPrefix(name, "/") {
		return "", errors.New("absolute path in archive: " + name)
	}
	joined := filepath.Join(dir, filepath.FromSlash(name))
	clean := filepath.Clean(dir) + string(os.PathSeparator)
	if !strings.HasPrefix(joined, clean) {
		return "", errors.New("path escapes destination: " + name)
	}
	return joined, nil
}

func UntarJobDir(r io.Reader, dir string) error {
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	tr := tar.NewReader(r)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			return nil
		}
		if err != nil {
			return err
		}
		if isScratchEntry(header.Name, header.Typeflag == tar.TypeDir) {
			continue
		}

		target, err := safeJoin(dir, header.Name)
		if err != nil {
			return err
		}

		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			f, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0644)
			if err != nil {
				return err
			}
			if _, err := io.Copy(f, tr); err != nil {
				f.Close()
				return err
			}
			if err := f.Close(); err != nil {
				return err
			}
		default:
			// skip symlinks, hardlinks, devices
			continue
		}
	}
}

// Moves everything below src into dst, overwriting
func mergeMove(src string, dst string, skip map[string]bool) error {
	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dst, 0755); err != nil {
		return err
	}

	for _, entry := range entries {
		if skip[entry.Name()] {
			continue
		}
		from := filepath.Join(src, entry.Name())
		to := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			info, err := os.Stat(to)
			if err == nil && info.IsDir() {
				if err := mergeMove(from, to, nil); err != nil {
					return err
				}
				continue
			}
			if err := os.RemoveAll(to); err != nil {
				return err
			}
			if err := os.Rename(from, to); err != nil {
				return err
			}
			continue
		}

		if err := os.RemoveAll(to); err != nil {
			return err
		}
		if err := os.Rename(from, to); err != nil {
			return err
		}
	}

	return nil
}
