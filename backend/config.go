package main

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
)

var defaultFileContent = []byte(`{
	// One of: mmseqs,foldseek,colabfold,predictprotein
	"app": "mmseqs",
	// should mmseqs und webserver output be printed
	"verbose": true,
	"server" : {
		"address"    : "127.0.0.1:8081",
		// prefix for all API endpoints
		"pathprefix" : "/api/",
		// enables additional API endpoints for adding databases
		// WARNING: No additional authentication provided. Enable only within trusted network/for trusted admins.
		"dbmanagment": false,
		/* enable HTTP Basic Auth (optional)
		"auth": {
			"username" : "",
			"password" : "",
		},
		// enable rate-limiting (optional)
		"ratelimit"  : {
			// this uses the token-bucket algorithm
			// i.e. we start with a full bucket (with burst tokens) and refill it at a given rate
			// each request consumes one token, if the bucket is empty the request is rejected
			// the example below starts with 20 tokens and refills 0.0333 token per second (2 tokens per minute)
			"rate"   : 0.03333333333333,
			"burst"  : 20,
			"ttl"    : 1,
			"reason" : "The foldseek server is a shared resource. Please be mindful about submitting many jobs.",
			// CIDRs to allow without rate-limiting
			"allowlist": [],
			// set to true to instead consume a token on every submission
			"chargeonsubmit": false,
		},
		*/
		// should CORS headers be set to allow requests from anywhere
		"cors"       : true,
		// should old jobs be checked on startup
		"checkold"   : true,
		/* enable the remote worker API below /api/worker/
		"workertoken" : "change-me",
		// how long a claimed job may go without a status update in seconds
		"workerlease" : 3600,
		*/
	},
	"worker": {
		// should workers exit immediately after SIGINT/SIGTERM signal or gracefully wait for job completion
		"gracefulexit": false,
		// How many databases can be searched in parallel (used additional CPUs)
		"paralleldatabases": 1,
		/* http worker against remote server 
		"remote" : "https://search.foldseek.com/",
		"token"  : "change-me",
		// job types this worker advertises
		"types"  : ["rnasearch"],
		// name reported to the server
		"name"   : "riboserver",
		// keep job folders after a successful upload
		"keepjobs" : false,
		*/
	},
	// paths to workfolders and mmseqs, special character ~ is resolved relative to the binary location
	"paths" : {
		// path to mmseqs databases, has to be shared between server/workers
		"databases"    : "~databases",
		// path to job results and scratch directory, has to be shared between server/workers
		"results"      : "~jobs",
		// temporary files for index building
		"temporary"    : "~tmp",
		/*
		// paths to colabfold templates
		"colabfold"    : {
			// configure GPU support for colabfold
			// GPU support for mmseqs and foldseek is configured in database .params files
			/*
			"gpu" : {
				// enable/disable
				"gpu": true,
				// enable gpuserver, saves about 1.5s per request in overhead
				"server": true,
				// set cuda visible devices for all databases, can be empty/omitted
				// "devices": "0,1,2",
				// set/override devices per database for better VRAM managment
				// "uniref_devices": "0",
				// "pdb_devices": "1",
				// "environmental_devices": "2",
			},
			*/
			// should stages be run in parallel
			"parallelstages": false,
			// paths for search databases
			"uniref"        : "~databases/uniref30_2103",
			"pdb"           : "~databases/pdb70",
			"environmental" : "~databases/colabfold_envdb_202108",
			"environmentalpair" : "~databases/spire_ctg10_2401_db",
			// riboseek nucleotide db
			"nucl"          : "~databases/nucl",
			// paths for templates
			"pdb70"         : "~databases/pdb70",
			"pdbdivided"    : "~databases/pdbdivided",
			"pdbobsolete"   : "~databases/pdbobsolete",
		},
		*/
		// path to foldseek binary
		"foldseek"     : "~foldseek",
		"foldseekinterface" : "~foldseek-interface",
		"foldmason"    : "~foldmason",
		"folddisco"    : "~folddisco",
		"foldcomp"     : "~foldcomp",
		"pdb100"       : "~pdb100",
		// path to mmseqs binary
		"mmseqs"       : "~mmseqs",
		// path to riboseek binary
		"riboseek"     : "~riboseek",
	},
	// connection details for redis database, not used in -local mode
	"redis" : {
		"network"  : "tcp",
		"address"  : "localhost:6379",
		"password" : "",
		"index"    : 0,
	},
	// options for local/single-binary server
	"local" : {
		"workers"  : 1,
		// should old jobs be checked on startup
		"checkold" : true,
		/* hand these job types to remote workers only
		"delegate" : ["rnasearch"],
		*/
	},
	"mail" : {
		"mailer" : {
			// three types available:
			// null: uses NullTransport class, which ignores all sent emails
			"type" : "null"
			/* smtp: Uses SMTP to send emails example for gmail
			"type" : "smtp",
			"transport" : {
				// full host URL with port
				"host" : "smtp.gmail.com:587",
				// RFC 4616  PLAIN authentication
				"auth" : {
					// empty for gmail
					"identity" : "",
					// gmail user
					"username" : "user@gmail.com",
					"password" : "password",
					"host" : "smtp.gmail.com",
				},
			},
			*/
			/* mailgun: Uses the mailgun API to send emails
			"type"      : "mailgun",
			"transport" : {
				// mailgun domain
				"domain" : "mail.mmseqs.com",
				// mailgun API private key
				"secretkey" : "key-XXXX",
				// mailgun API public key
				"publickey" : "pubkey-XXXX",
			},
			*/
		},
		// Email FROM field
		"sender"    : "mail@example.org",
		/* Bracket notation is also possible:
		"sender"    : "Webserver <mail@example.org>",
		*/
		// Email templates. First "%s" is resolved to the ticket identifier
		"templates" : {
			"success" : {
				"subject" : "Done -- %s",
				"body"    : "%s",
			},
			"timeout" : {
				"subject" : "Timeout -- %s",
				"body"    : "%s",
			},
			"error"   : {
				"subject" : "Error -- %s",
				"body"    : "%s",
			}
		}
	}
	}
`)

type ColabFoldGpuConfig struct {
	GpuConfig
	UnirefDevices        string `json:"uniref_devices,omitempty"`
	PdbDevices           string `json:"pdb_devices,omitempty"`
	EnvironmentalDevices string `json:"environmental_devices,omitempty"`
}

type ConfigColabFoldPaths struct {
	ParallelStages    bool   `json:"parallelstages"`
	Uniref            string `json:"uniref"`
	Pdb               string `json:"pdb"`
	Environmental     string `json:"environmental"`
	EnvironmentalPair string `json:"environmentalpair"`
	Nucleotide        string `json:"nucl"`
	Pdb70             string `json:"pdb70"`
	PdbDivided        string `json:"pdbdivided"`
	PdbObsolete       string `json:"pdbobsolete"`

	Gpu *ColabFoldGpuConfig `json:"gpu,omitempty"`
}

type ConfigPaths struct {
	Databases         string                `json:"databases"`
	Results           string                `json:"results"`
	Temporary         string                `json:"temporary"`
	Mmseqs            string                `json:"mmseqs"`
	Riboseek          string                `json:"riboseek"`
	Foldseek          string                `json:"foldseek"`
	FoldseekInterface string                `json:"foldseekinterface"`
	FoldMason         string                `json:"foldmason"`
	FoldDisco         string                `json:"folddisco"`
	FoldComp          string                `json:"foldcomp"`
	Pdb100            string                `json:"pdb100"`
	ColabFold         *ConfigColabFoldPaths `json:"colabfold"`
}

type ConfigRedis struct {
	Network  string `json:"network"`
	Address  string `json:"address"`
	Password string `json:"password"`
	DbIndex  int    `json:"index"`
}

type ConfigLocal struct {
	Workers  int       `json:"workers"`
	CheckOld bool      `json:"checkold"`
	Delegate []JobType `json:"delegate"`
}

type ConfigMailTemplate struct {
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

type ConfigMailTemplates struct {
	Success ConfigMailTemplate `json:"success"`
	Timeout ConfigMailTemplate `json:"timeout"`
	Error   ConfigMailTemplate `json:"error"`
}

type ConfigMail struct {
	Mailer    *ConfigMailtransport `json:"mailer"`
	Sender    string               `json:"sender"`
	Templates ConfigMailTemplates  `json:"templates"`
}

type ConfigAuth struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required"`
}

type ConfigRateLimit struct {
	Rate           float64  `json:"rate" validate:"required"`
	Burst          int      `json:"burst" validate:"required"`
	TTL            int      `json:"ttl" validate:"required"`
	IpLookupHeader string   `json:"ipheader"`
	Reason         string   `json:"reason"`
	AllowList      []string `json:"allowlist"`
	ChargeOnSubmit bool     `json:"chargeonsubmit"`
}

type ConfigWorker struct {
	GracefulExit      bool      `json:"gracefulexit"`
	ParallelDatabases int       `json:"paralleldatabases"`
	Remote            string    `json:"remote"`
	Token             string    `json:"token"`
	Types             []JobType `json:"types"`
	Name              string    `json:"name"`
	KeepJobs          bool      `json:"keepjobs"`
}

type ConfigServer struct {
	Address     string           `json:"address" validate:"required"`
	PathPrefix  string           `json:"pathprefix"`
	DbManagment bool             `json:"dbmanagment"`
	CORS        bool             `json:"cors"`
	CheckOld    bool             `json:"checkold"`
	WorkerToken string           `json:"workertoken"`
	WorkerLease int              `json:"workerlease"`
	Auth        *ConfigAuth      `json:"auth"`
	RateLimit   *ConfigRateLimit `json:"ratelimit"`
}

type ConfigApp string

const (
	AppMMseqs2        ConfigApp = "mmseqs"
	AppFoldseek       ConfigApp = "foldseek"
	AppColabFold      ConfigApp = "colabfold"
	AppPredictProtein ConfigApp = "predictprotein"
)

type ConfigRoot struct {
	App     ConfigApp    `json:"app" validate:"oneof=mmseqs foldseek colabfold predictprotein"`
	Server  ConfigServer `json:"server" validate:"required"`
	Worker  ConfigWorker `json:"worker"`
	Paths   ConfigPaths  `json:"paths" validate:"required"`
	Redis   ConfigRedis  `json:"redis"`
	Local   ConfigLocal  `json:"local"`
	Mail    ConfigMail   `json:"mail"`
	Verbose bool         `json:"verbose"`
}

func ReadConfigFromFile(name string) (ConfigRoot, error) {
	file, err := os.Open(name)
	if err != nil {
		return ConfigRoot{}, err
	}
	defer file.Close()

	absPath, err := filepath.Abs(name)
	if err != nil {
		return ConfigRoot{}, err
	}

	relativeTo := filepath.Dir(absPath)

	return ReadConfig(file, relativeTo)
}

func DefaultConfig() (ConfigRoot, error) {
	r := bytes.NewReader(defaultFileContent)

	ex, err := os.Executable()
	if err != nil {
		panic(err)
	}
	relativeTo := filepath.Dir(ex)

	return ReadConfig(r, relativeTo)
}

func WriteDefaultConfig(path string) error {
	return os.WriteFile(path, []byte(defaultFileContent), 0644)
}

func ReadConfig(r io.Reader, relativeTo string) (ConfigRoot, error) {
	var config ConfigRoot

	// set default values
	config.Local.CheckOld = true

	if err := DecodeJsonAndValidate(r, &config); err != nil {
		return config, fmt.Errorf("fatal error for config file: %s", err)
	}

	paths := []*string{&config.Paths.Databases, &config.Paths.Results, &config.Paths.Temporary}

	if config.App == AppMMseqs2 || config.App == AppColabFold || config.App == AppPredictProtein {
		paths = append(paths, &config.Paths.Mmseqs)
	}

	if config.App == AppFoldseek {
		paths = append(
			paths,
			&config.Paths.Riboseek,
			&config.Paths.Foldseek,
			&config.Paths.FoldseekInterface,
			&config.Paths.FoldMason,
			&config.Paths.FoldDisco,
			&config.Paths.FoldComp,
			&config.Paths.FoldseekInterface,
		)
	}

	if config.App == AppColabFold && config.Paths.ColabFold != nil {
		paths = append(
			paths,
			&config.Paths.Riboseek,
			&config.Paths.ColabFold.Uniref,
			&config.Paths.ColabFold.Pdb,
			&config.Paths.ColabFold.Environmental,
			&config.Paths.ColabFold.EnvironmentalPair,
			&config.Paths.ColabFold.Nucleotide,
			&config.Paths.ColabFold.Pdb70,
			&config.Paths.ColabFold.PdbDivided,
			&config.Paths.ColabFold.PdbObsolete,
		)
	}
	for _, path := range paths {
		if strings.HasPrefix(*path, "~") {
			*path = strings.TrimLeft(*path, "~")
			*path = filepath.Join(relativeTo, *path)
		}
	}

	return config, nil
}

type binaryRequirement struct {
	Path  string
	Name  string
	Types []JobType
}

func (c *ConfigRoot) binaryRequirements() []binaryRequirement {
	if c.App == AppFoldseek {
		return []binaryRequirement{
			{c.Paths.Foldseek, "Foldseek", []JobType{JobStructureSearch, JobComplexSearch, JobInterfaceSearch, JobFoldDisco, JobIndex}},
			{c.Paths.FoldMason, "FoldMason", []JobType{JobFoldMasonMSA}},
			{c.Paths.FoldDisco, "FoldDisco", []JobType{JobFoldDisco}},
			{c.Paths.FoldseekInterface, "FoldseekInterface", []JobType{JobInterfaceSearch}},
		}
	}
	return []binaryRequirement{
		{c.Paths.Mmseqs, "MMseqs2", []JobType{JobSearch, JobIndex, JobMsa, JobPair}},
	}
}

func (c *ConfigRoot) CheckPaths(types []JobType) error {
	paths := []string{c.Paths.Databases, c.Paths.Results}
	for _, path := range paths {
		if _, err := os.Stat(path); os.IsNotExist(err) {
			os.MkdirAll(path, 0755)
		}
	}

	for _, req := range c.binaryRequirements() {
		needed := types == nil
		for _, t := range req.Types {
			if jobTypeAllowed(types, t) {
				needed = true
				break
			}
		}
		if !needed {
			continue
		}
		if _, err := os.Stat(req.Path); err != nil {
			return errors.New(req.Name + " binary was not found at " + req.Path)
		}
	}

	if c.App == AppColabFold {
		if c.Paths.ColabFold == nil {
			return errors.New("ColabFold paths are not set")
		}
	}

	return nil
}

func (c *ConfigRoot) ReadParameters(args []string) error {
	var key string
	inParameter := false
	for _, arg := range args {
		if strings.HasPrefix(arg, "-") {
			if inParameter {
				return errors.New("invalid parameter string")
			}
			key = strings.TrimLeft(arg, "-")
			inParameter = true
		} else {
			if !inParameter {
				return errors.New("invalid parameter string")
			}
			err := c.setParameter(key, arg)
			if err != nil {
				return err
			}
			inParameter = false
		}
	}

	if inParameter {
		return errors.New("invalid parameter string")
	}

	return nil
}

func (c *ConfigRoot) setParameter(key string, value string) error {
	path := strings.Split(key, ".")
	return setNodeValue(c, path, value)
}

// DFS in Config Tree to set the new value
func setNodeValue(node interface{}, path []string, value string) error {
	if len(path) == 0 {
		if v, ok := node.(reflect.Value); ok {
			if !v.IsValid() || !v.CanSet() {
				return errors.New("leaf node is not valid")
			}

			switch v.Kind() {
			case reflect.Struct:
				return errors.New("leaf node is a struct")
			case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
				i, err := strconv.ParseInt(value, 10, 64)
				if err != nil {
					return err
				}
				v.SetInt(i)
			case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
				i, err := strconv.ParseUint(value, 10, 64)
				if err != nil {
					return err
				}
				v.SetUint(i)
			case reflect.Bool:
				b, err := strconv.ParseBool(value)
				if err != nil {
					return err
				}
				v.SetBool(b)
			case reflect.String:
				v.SetString(value)
			default:
				return errors.New("leaf node type not implemented")
			}
			return nil
		} else {
			return errors.New("leaf node is not a value")
		}
	}

	v, ok := node.(reflect.Value)
	if !ok {
		v = reflect.ValueOf(node).Elem()
	}

	if v.Kind() == reflect.Ptr {
		if v.IsNil() {
			t := v.Type().Elem()
			n := reflect.New(t)
			v.Set(n)
		}
		v = v.Elem()
	}

	if v.Kind() != reflect.Struct {
		return errors.New("node is not a struct")
	}

	for i := 0; i < v.NumField(); i++ {
		field := v.Type().Field(i)
		tag := field.Tag.Get("json")
		// support embedded structs (anonymous fields)
		if tag == "" && field.Anonymous && v.Field(i).Kind() == reflect.Struct {
			if err := setNodeValue(v.Field(i), path, value); err == nil {
				return nil
			}
			continue
		}

		if tag == "-" {
			continue
		}

		splits := strings.Split(tag, ",")
		for _, t := range splits {
			if t == "omitempty" {
				continue
			}
			tag = t
			break
		}
		if tag == path[0] {
			f := v.Field(i)
			return setNodeValue(f, path[1:], value)
		}
	}

	return errors.New("path not found in config")
}
