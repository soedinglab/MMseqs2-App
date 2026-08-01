package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime/debug"
	"strings"
	"syscall"
)

type RunType int

const (
	LOCAL RunType = iota
	WORKER
	SERVER
	UTIL_VERSION
	UTIL_PRINT_CONFIG
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
		case "-print-config":
			t = UTIL_PRINT_CONFIG
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

type RemoteWorkerFlags struct {
	Remote string
	Token  string
	Types  string
	Name   string
}

func ParseRemoteWorkerFlags(args []string) (RemoteWorkerFlags, []string) {
	var flags RemoteWorkerFlags
	targets := map[string]*string{
		"-remote": &flags.Remote,
		"-token":  &flags.Token,
		"-types":  &flags.Types,
		"-name":   &flags.Name,
	}

	resArgs := make([]string, 0)
	for i := 0; i < len(args); i++ {
		target, ok := targets[args[i]]
		if !ok {
			resArgs = append(resArgs, args[i])
			continue
		}
		if i+1 == len(args) {
			log.Fatal(errors.New("value for " + args[i] + " is not specified"))
		}
		*target = args[i+1]
		i++
	}

	return flags, resArgs
}

func (f RemoteWorkerFlags) Apply(config *ConfigRoot) error {
	if f.Remote != "" {
		config.Worker.Remote = f.Remote
	}
	if f.Token != "" {
		config.Worker.Token = f.Token
	}
	if f.Name != "" {
		config.Worker.Name = f.Name
	}
	if f.Types != "" {
		types, err := ParseJobTypes(strings.Split(f.Types, ","))
		if err != nil {
			return err
		}
		config.Worker.Types = types
	}
	return nil
}

// What this process is allowed to run
func runnableJobTypes(t RunType, config ConfigRoot) []JobType {
	if t == WORKER && config.Worker.Remote != "" {
		return config.Worker.Types
	}
	if len(config.Local.Delegate) == 0 {
		return nil
	}
	return SubtractJobTypes(AllJobTypes, config.Local.Delegate)
}

func warnAboutDelegation(t RunType, config ConfigRoot) {
	if len(config.Local.Delegate) == 0 {
		return
	}
	for _, jobtype := range config.Local.Delegate {
		if !jobtype.Valid() {
			log.Fatal(errors.New("local.delegate lists unknown job type: " + string(jobtype)))
		}
	}
	if t == SERVER || t == WORKER {
		log.Println("WARNING: local.delegate is ignored by the redis queue, it only applies to -local")
		return
	}
	if config.Server.WorkerToken == "" {
		log.Println("WARNING: local.delegate is set but server.workertoken is not, so no remote worker can connect and delegated jobs will stay PENDING")
	}
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
	remoteFlags, args := ParseRemoteWorkerFlags(args)

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

	if err := remoteFlags.Apply(&config); err != nil {
		panic(err)
	}

	if t == UTIL_PRINT_CONFIG {
		out, err := json.MarshalIndent(config, "", "    ")
		if err != nil {
			panic(err)
		}
		fmt.Println(string(out))
		return
	}

	types := runnableJobTypes(t, config)
	warnAboutDelegation(t, config)

	if err := config.CheckPaths(types); err != nil {
		panic(err)
	}

	switch t {
	case WORKER:
		if config.Worker.Remote != "" {
			jobsystem, err := MakeHttpJobSystem(config)
			if err != nil {
				panic(err)
			}
			worker(jobsystem, config, types)
			return
		}
		jobsystem, err := MakeRedisJobSystem(config.Redis, config.Paths.Results, false)
		if err != nil {
			panic(err)
		}
		worker(jobsystem, config, types)
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
			go worker(&jobsystem, config, types)
		}
		go server(&jobsystem, config)
		<-loop
	}
}
