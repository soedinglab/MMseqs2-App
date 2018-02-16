SRCPATH := src/backend
GOPATH := $(shell greadlink -f . || readlink -f . )

all: vendor
	export GOPATH=$(GOPATH); \
	cd $(SRCPATH); \
	govendor build -o $(GOPATH)/build/mmseqs-backend

vendor:
	export GOPATH=$(GOPATH); \
	cd $(SRCPATH); \
	govendor init; \
	govendor fetch +outside
