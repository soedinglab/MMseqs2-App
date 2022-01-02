// +build !windows

package main

import (
	"os/exec"

	"golang.org/x/sys/unix"
)

func SetSysProcAttr(cmd *exec.Cmd) {
	cmd.SysProcAttr = &unix.SysProcAttr{Setpgid: true}
}

func KillCommand(cmd *exec.Cmd) error {
	return unix.Kill(-cmd.Process.Pid, unix.SIGKILL)
}
