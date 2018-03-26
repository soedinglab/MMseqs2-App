SRCPATH := src/backend
GOPATH := $(shell greadlink -f . || readlink -f . )
BINPATH ?= $(GOPATH)/build/mmseqs-backend

ifdef DEBUG
	DEBUGFLAGS = -gcflags "-N -l"
else
	DEBUGFLAGS =
endif

all: vendor
	export GOPATH=$(GOPATH); \
	cd $(SRCPATH); \
	govendor build -i $(DEBUGFLAGS) -o $(BINPATH)

vendor:
	export GOPATH=$(GOPATH); \
	cd $(SRCPATH); \
	govendor init; \
	govendor fetch +outside
