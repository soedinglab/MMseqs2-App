package main

import (
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime/debug"
	"syscall"
)

type RunType int

const (
	LOCAL RunType = iota
	WORKER
	SERVER
	UTIL_VERSION
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
		case "-version":
			t = UTIL_VERSION
			continue
		}

		resArgs = append(resArgs, arg)
	}

	return t, resArgs
}

func ParseConfigName(args []string) (string, []string) {
	resArgs := make([]string, 0)
	file := ""
	for i := 0; i < len(args); i++ {
		if args[i] == "-config" {
			if i+1 == len(args) {
				log.Fatal(errors.New("config file name is not specified"))
			}
			file = args[i+1]
			i++
			continue
		}

		resArgs = append(resArgs, args[i])
	}

	return file, resArgs
}

func main() {
	t, args := ParseType(os.Args[1:])

	if t == UTIL_VERSION {
		info, ok := debug.ReadBuildInfo()
		if !ok {
			fmt.Println("unknown")
			return
		}
		for _, kv := range info.Settings {
			if kv.Value == "" {
				continue
			}
			switch kv.Key {
			case "vcs.revision":
				fmt.Println(kv.Value)
				return
			}
		}
		return
	}

	configFile, args := ParseConfigName(args)

	var config ConfigRoot
	var err error
	if len(configFile) > 0 {
		if _, err := os.Stat(configFile); errors.Is(err, os.ErrNotExist) {
			log.Println("Creating config file: " + configFile)
			err = WriteDefaultConfig(configFile)
			if err != nil {
				panic(err)
			}
		}
		config, err = ReadConfigFromFile(configFile)

	} else {
		config, err = DefaultConfig()
	}
	if err != nil {
		panic(err)
	}

	err = config.ReadParameters(args)
	if err != nil {
		panic(err)
	}

	if err := config.CheckPaths(); err != nil {
		panic(err)
	}

	switch t {
	case WORKER:
		jobsystem, err := MakeRedisJobSystem(config.Redis, config.Paths.Results, false)
		if err != nil {
			panic(err)
		}
		worker(jobsystem, config)
	case SERVER:
		jobsystem, err := MakeRedisJobSystem(config.Redis, config.Paths.Results, config.Server.CheckOld)
		if err != nil {
			panic(err)
		}
		server(jobsystem, config)
	case LOCAL:
		jobsystem, err := MakeLocalJobSystem(config.Paths.Results, config.Local.CheckOld)
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
		for i := 0; i < config.Local.Workers; i++ {
			go worker(&jobsystem, config)
		}
		go server(&jobsystem, config)
		<-loop
	}
}
