package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

type ConfigPaths struct {
	Databases    string `json:"databases"`
	Results      string `json:"results"`
	SearchScript string `json:"searchscript"`
	Mmseqs       string `json:"mmseqs"`
}

type ConfigRedis struct {
	Network  string `json:"network"`
	Address  string `json:"address"`
	Password string `json:"password"`
	DbIndex  int    `json:"index"`
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
	Transport string              `json:"type"`
	Sender    string              `json:"sender"`
	Templates ConfigMailTemplates `json:"templates"`
}

type ConfigRoot struct {
	Address string      `json:"address" valid:"required"`
	Paths   ConfigPaths `json:"paths" valid:"required"`
	Redis   ConfigRedis `json:"redis" valid:"optional"`
	Mail    ConfigMail  `json:"mail" valid:"optional"`
}

func ReadConfig(fileName string) (ConfigRoot, error) {
	var config ConfigRoot

	file, err := os.Open(fileName)
	if err != nil {
		return config, err
	}
	defer file.Close()

	absPath, err := filepath.Abs(fileName)
	if err != nil {
		return config, err
	}

	base := filepath.Dir(absPath)

	if err := DecodeJsonAndValidate(file, &config); err != nil {
		return config, fmt.Errorf("Fatal error for config file: %s\n", err)
	}

	paths := []*string{&config.Paths.Databases, &config.Paths.Results, &config.Paths.SearchScript, &config.Paths.Mmseqs}
	for _, path := range paths {
		if (*path)[0] == '~' {
			*path = strings.TrimLeft(*path, "~")
			*path = filepath.Join(base, *path)
		}

		if _, err := os.Stat(*path); err != nil {
			return config, err
		}
	}

	return config, nil
}
