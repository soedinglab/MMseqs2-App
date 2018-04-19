#!/bin/sh -e
GOOS=$1 GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $2
