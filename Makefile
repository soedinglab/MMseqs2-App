.PHONY: all clean

all: build/icon.icns build/icon.ico win mac linux

win: resources/win/x64/mmseqs.bat resources/win/x64/mmseqs-web-backend.exe
mac: resources/mac/x64/mmseqs resources/mac/arm64/mmseqs resources/mac/arm64/mmseqs-web-backend resources/mac/x64/mmseqs-web-backend
linux: resources/linux/arm64/mmseqs resources/linux/arm64/mmseqs-web-backend resources/linux/x64/mmseqs resources/linux/x64/mmseqs-web-backend

mmseqshash := 19064f27c8d86fcdcd3daad60f6db70f6360f30b

build/icon.icns build/icon.ico: ICONS.intermediate ;
.INTERMEDIATE: ICONS.intermediate
ICONS.intermediate: frontend/assets/marv1-square.svg
	mkdir -p build
	./node_modules/.bin/icon-gen -i frontend/assets/marv1-square.svg -o build --icns --icns-name icon --ico --ico-name icon

resources/mac/x64/mmseqs-web-backend: backend/*.go backend/go.*
	mkdir -p resources/mac/x64
	cd backend/ && GOOS=darwin GOARCH=amd64  CGO_ENABLED=0 go build -o ../resources/mac/x64/mmseqs-web-backend

resources/mac/arm64/mmseqs-web-backend: backend/*.go backend/go.*
	mkdir -p resources/mac/arm64
	cd backend/ && GOOS=darwin GOARCH=arm64  CGO_ENABLED=0 go build -o ../resources/mac/arm64/mmseqs-web-backend

resources/linux/x64/mmseqs-web-backend: backend/*.go backend/go.*
	mkdir -p resources/linux/x64
	cd backend/ && GOOS=linux  GOARCH=amd64  CGO_ENABLED=0 go build -o ../resources/linux/x64/mmseqs-web-backend

resources/linux/arm64/mmseqs-web-backend: backend/*.go backend/go.*
	mkdir -p resources/linux/arm64
	cd backend/ && GOOS=linux  GOARCH=arm64  CGO_ENABLED=0 go build -o ../resources/linux/arm64/mmseqs-web-backend

resources/win/x64/mmseqs-web-backend.exe: backend/*.go backend/go.*
	mkdir -p resources/win/x64
	cd backend/ && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o ../resources/win/x64/mmseqs-web-backend.exe

resources/mac/mmseqs:
	mkdir -p resources/mac
	wget -nv -q -O - https://mmseqs.com/archive/$(mmseqshash)/mmseqs-osx-universal.tar.gz | tar -xOf - mmseqs/bin/mmseqs > resources/mac/mmseqs
	chmod +x resources/mac/mmseqs

resources/mac/x64/mmseqs: resources/mac/mmseqs
	mkdir -p resources/mac/x64
	lipo resources/mac/mmseqs -remove arm64 -output resources/mac/x64/mmseqs || cp -f -- resources/mac/mmseqs resources/mac/x64/mmseqs

resources/mac/arm64/mmseqs: resources/mac/mmseqs
	mkdir -p resources/mac/arm64
	lipo resources/mac/mmseqs -thin arm64 -output resources/mac/arm64/mmseqs || cp -f -- resources/mac/mmseqs resources/mac/arm64/mmseqs

resources/linux/x64/mmseqs-sse41:
	mkdir -p resources/linux/x64
	wget -nv -q -O - https://mmseqs.com/archive/$(mmseqshash)/mmseqs-linux-sse41.tar.gz | tar -xOf - mmseqs/bin/mmseqs > resources/linux/x64/mmseqs-sse41
	chmod +x resources/linux/x64/mmseqs-sse41

resources/linux/x64/mmseqs-avx2:
	mkdir -p resources/linux/x64
	wget -nv -q -O - https://mmseqs.com/archive/$(mmseqshash)/mmseqs-linux-avx2.tar.gz | tar -xOf - mmseqs/bin/mmseqs > resources/linux/x64/mmseqs-avx2
	chmod +x resources/linux/x64/mmseqs-avx2

resources/linux/x64/mmseqs: electron/mmseqs-wrapper.sh resources/linux/x64/mmseqs-avx2 resources/linux/x64/mmseqs-sse41
	cp electron/mmseqs-wrapper.sh resources/linux/x64/mmseqs
	chmod +x resources/linux/x64/mmseqs

resources/linux/arm64/mmseqs:
	mkdir -p resources/linux/arm64
	wget -nv -q -O - https://mmseqs.com/archive/$(mmseqshash)/mmseqs-linux-arm64.tar.gz | tar -xOf - mmseqs/bin/mmseqs > resources/linux/arm64/mmseqs
	chmod +x resources/linux/arm64/mmseqs

resources/win/x64/mmseqs.bat:
	mkdir -p resources/win/x64
	cd resources/win/x64 && wget -nv -O mmseqs-win64.zip https://mmseqs.com/archive/$(mmseqshash)/mmseqs-win64.zip \
		&& unzip mmseqs-win64.zip && mv mmseqs/* . && rmdir mmseqs && rm mmseqs-win64.zip
	chmod -R +x resources/win/x64/mmseqs.bat resources/win/x64/bin/*

clean:
	@rm -f build/icon.icns build/icon.ico
	@rm -rf resources/mac/* resources/linux/* resources/win/*
