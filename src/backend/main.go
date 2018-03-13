package main

import (
	"os"
	"os/signal"
	"syscall"
)

type RunType int

const (
	LOCAL RunType = iota
	WORKER
	SERVER
)

func ParseType(args []string) (RunType, []string) {
	resArgs := make([]string, 0)
	t := SERVER
	for _, arg := range args {
		switch arg {
		case "-worker":
			t = WORKER
			continue
		case "-server":
			t = SERVER
			continue
		case "-local":
			t = LOCAL
			continue
		}

		resArgs = append(resArgs, arg)
	}

	return t, resArgs
}

func main() {
	t, args := ParseType(os.Args[1:])

	configFile := "config.json"
	config, err := ReadConfig(configFile)
	if err != nil {
		panic(err)
	}

	err = config.ReadParameters(args)
	if err != nil {
		panic(err)
	}

	if config.CheckPaths() == false {
		panic("Invalid Paths Supplied")
	}

	switch t {
	case WORKER:
		worker(MakeRedisJobSystem(config.Redis), config)
		break
	case SERVER:
		server(MakeRedisJobSystem(config.Redis), config)
		break
	case LOCAL:
		jobsystem, err := MakeLocalJobSystem(config.Paths.Results)
		if err != nil {
			panic(err)
		}

		sigs := make(chan os.Signal, 1)
		signal.Notify(sigs, os.Interrupt, syscall.SIGTERM)
		go func() {
			<-sigs
			os.Exit(0)
		}()

		loop := make(chan bool)
		go worker(&jobsystem, config)
		go server(&jobsystem, config)
		<-loop
		break
	}
}
