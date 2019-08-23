.PHONY: all clean

all: resources/icons/icon.icns resources/icons/icon.ico win mac linux

win: resources/win/mmseqs.bat resources/win/mmseqs-web-backend.exe resources/win/cpu-check.exe
mac: resources/mac/mmseqs-sse41 resources/mac/mmseqs-avx2 resources/mac/mmseqs-web-backend resources/mac/cpu-check
linux: resources/linux/mmseqs-sse41 resources/linux/mmseqs-avx2 resources/linux/mmseqs-web-backend resources/linux/cpu-check

mmseqshash := 6d92cd21676ccc36531f2852f7eb747f6389435f

resources/icons/icon.icns resources/icons/icon.ico: frontend/assets/marv1-square.svg
	mkdir -p resources/icons
	./node_modules/.bin/icon-gen -i frontend/assets/marv1-square.svg -o resources/icons/ --icns name=icon --ico name=icon

resources/mac/mmseqs-web-backend: backend/*.go backend/go.*
	mkdir -p resources/mac
	cd backend/ && GOOS=darwin GOARCH=amd64  CGO_ENABLED=0 go build -o ../resources/mac/mmseqs-web-backend

resources/linux/mmseqs-web-backend: backend/*.go backend/go.*
	mkdir -p resources/linux
	cd backend/ && GOOS=linux  GOARCH=amd64  CGO_ENABLED=0 go build -o ../resources/linux/mmseqs-web-backend

resources/win/mmseqs-web-backend.exe: backend/*.go backend/go.*
	mkdir -p resources/win
	cd backend/ && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o ../resources/win/mmseqs-web-backend.exe

resources/mac/cpu-check: cpu-check/*.go cpu-check/go.*
	mkdir -p resources/mac
	cd cpu-check/ && GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o ../resources/mac/cpu-check

resources/linux/cpu-check: cpu-check/*.go cpu-check/go.*
	mkdir -p resources/linux
	cd cpu-check/ && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o ../resources/linux/cpu-check

resources/win/cpu-check.exe: cpu-check/*.go cpu-check/go.*
	mkdir -p resources/win
	cd cpu-check/ && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o ../resources/win/cpu-check.exe

resources/mac/mmseqs-sse41:
	mkdir -p resources/mac
	cd resources/mac && wget -nv -O mmseqs.tar.gz https://mmseqs.com/archive/$(mmseqshash)/mmseqs-osx-sse41.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs/bin/mmseqs && mv mmseqs mmseqs-sse41 && rm mmseqs.tar.gz

resources/mac/mmseqs-avx2:
	mkdir -p resources/mac
	cd resources/mac && wget -nv -O mmseqs.tar.gz https://mmseqs.com/archive/$(mmseqshash)/mmseqs-osx-avx2.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs/bin/mmseqs && mv mmseqs mmseqs-avx2 && rm mmseqs.tar.gz

resources/linux/mmseqs-sse41:
	mkdir -p resources/linux
	cd resources/linux && wget -nv -O mmseqs.tar.gz https://mmseqs.com/archive/$(mmseqshash)/mmseqs-linux-sse41.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs/bin/mmseqs && mv mmseqs mmseqs-sse41 && rm mmseqs.tar.gz

resources/linux/mmseqs-avx2:
	mkdir -p resources/linux
	cd resources/linux && wget -nv -O mmseqs.tar.gz https://mmseqs.com/archive/$(mmseqshash)/mmseqs-linux-avx2.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs/bin/mmseqs && mv mmseqs mmseqs-avx2 && rm mmseqs.tar.gz

resources/win/mmseqs.bat:
	mkdir -p resources/win
	cd resources/win && wget -nv -O mmseqs-win64.zip https://mmseqs.com/archive/$(mmseqshash)/mmseqs-win64.zip \
		&& unzip mmseqs-win64.zip && mv mmseqs/* . && rmdir mmseqs && rm mmseqs-win64.zip
	chmod -R +x resources/win/mmseqs.bat resources/win/bin/*

clean:
	@rm -f resources/icons/icon.icns resources/icons/icon.ico
	@rm -rf resources/mac/* resources/linux/* resources/win/*
