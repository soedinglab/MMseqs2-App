//go:build windows
// +build windows

package main

import (
	"os/exec"
)

func SetSysProcAttr(cmd *exec.Cmd) {
}

func KillCommand(cmd *exec.Cmd) error {
	return cmd.Process.Kill()
}
