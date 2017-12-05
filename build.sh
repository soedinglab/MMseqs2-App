#!/bin/sh -e
GOOS=darwin  GOARCH=amd64 go build -ldflags="-s -w" -o cpu-check-darwin
GOOS=linux   GOARCH=amd64 go build -ldflags="-s -w" -o cpu-check-linux
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o cpu-check-windows