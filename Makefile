.PHONY: all clean

all: resources/icons/256x256.png resources/icons/icon.icns resources/icons/icon.ico \
	win mac linux

win: resources/win/mmseqs.bat resources/win/mmseqs-web-backend.exe resources/win/cpu-check.exe
mac: resources/mac/mmseqs-sse41 resources/mac/mmseqs-avx2 resources/mac/mmseqs-web-backend resources/mac/cpu-check
linux: resources/linux/mmseqs-sse41 resources/linux/mmseqs-avx2 resources/linux/mmseqs-web-backend resources/linux/cpu-check

mmseqshash := ddad1ffdefaa0acb8fa51559ff273d97e46bdc88

resources/icons/256x256.png:
	mkdir -p resources/icons
	./node_modules/.bin/svg2png frontend/assets/marv1-square.svg --output=resources/icons/256x256.png --width=256 --height=256

resources/icons/icon.icns:
	mkdir -p resources/icons
	./node_modules/.bin/icon-gen -i frontend/assets/marv1-square.svg -o resources/icons/ -m icns -n icns=icon

resources/icons/icon.ico:
	mkdir -p resources/icons
	./node_modules/.bin/icon-gen -i frontend/assets/marv1-square.svg -o resources/icons/ -m ico -n ico=icon

CURRDIRR := $(shell greadlink -f . || readlink -f . )
resources/mac/mmseqs-web-backend:
	mkdir -p resources/mac
	cd backend/ && GOOS=darwin GOARCH=amd64  CGO_ENABLED=0 BINPATH=$(CURRDIRR)/resources/mac/mmseqs-web-backend make all

resources/linux/mmseqs-web-backend:
	mkdir -p resources/linux
	cd backend/ && GOOS=linux  GOARCH=amd64  CGO_ENABLED=0 BINPATH=$(CURRDIRR)/resources/linux/mmseqs-web-backend  make all

resources/win/mmseqs-web-backend.exe:
	mkdir -p resources/win
	cd backend/ && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 BINPATH=$(CURRDIRR)/resources/win/mmseqs-web-backend.exe make all

resources/mac/cpu-check:
	mkdir -p resources/mac
	cd cpu-check/ && GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(CURRDIRR)/resources/mac/cpu-check

resources/linux/cpu-check:
	mkdir -p resources/linux
	cd cpu-check/ && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(CURRDIRR)/resources/linux/cpu-check

resources/win/cpu-check.exe:
	mkdir -p resources/win
	cd cpu-check/ && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(CURRDIRR)/resources/win/cpu-check.exe

resources/mac/mmseqs-sse41:
	mkdir -p resources/mac
	cd resources/mac && wget -nv -O mmseqs.tar.gz https://mmseqs.com/archive/$(mmseqshash)/mmseqs-osx-static_sse41.tar.gz\
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs/bin/mmseqs && mv mmseqs mmseqs-sse41 && rm mmseqs.tar.gz

resources/mac/mmseqs-avx2:
	mkdir -p resources/mac
	cd resources/mac && wget -nv -O mmseqs.tar.gz https://mmseqs.com/archive/$(mmseqshash)/mmseqs-osx-static_avx2.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs/bin/mmseqs && mv mmseqs mmseqs-avx2 && rm mmseqs.tar.gz

resources/linux/mmseqs-sse41:
	mkdir -p resources/linux
	cd resources/linux && wget -nv -O mmseqs.tar.gz https://mmseqs.com/archive/$(mmseqshash)/mmseqs-static_sse41.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs2/bin/mmseqs && mv mmseqs mmseqs-sse41 && rm mmseqs.tar.gz

resources/linux/mmseqs-avx2:
	mkdir -p resources/linux
	cd resources/linux && wget -nv -O mmseqs.tar.gz https://mmseqs.com/archive/$(mmseqshash)/mmseqs-static_avx2.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs2/bin/mmseqs && mv mmseqs mmseqs-avx2 && rm mmseqs.tar.gz

resources/win/mmseqs.bat:
	mkdir -p resources/win
	cd resources/win && wget -nv https://mmseqs.com/archive/$(mmseqshash)/mmseqs-win64.zip && unzip mmseqs-win64.zip && mv mmseqs/* . && rmdir mmseqs && rm mmseqs-win64.zip

clean:
	rm -f build/icons/256x256.png build/icons/icon.icns build/icons/icon.ico
	rm -rf resources/mac/* resources/linux/*  resources/win/*
