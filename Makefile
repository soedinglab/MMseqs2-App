.PHONY: all clean

mmseqshash := 19064f27c8d86fcdcd3daad60f6db70f6360f30b
foldseekhash := 90b254585d398393cbca9c3515feb4ec4a1e7a9f

ifeq (${FRONTEND_APP},mmseqs)
hash := ${mmseqshash}
all: build/icon.icns build/icon.ico win mac linux
else
hash := ${foldseekhash}
all: build/icon.icns build/icon.ico mac linux
endif

ifneq ($(shell uname -s),Darwin)
# llvm-lipo is part of llvm since release 14
LIPO ?= llvm-lipo
else
LIPO ?= lipo
endif

win: resources/win/x64/${FRONTEND_APP}.bat resources/win/x64/mmseqs-web-backend.exe
mac: resources/mac/x64/${FRONTEND_APP} resources/mac/arm64/${FRONTEND_APP} resources/mac/arm64/mmseqs-web-backend resources/mac/x64/mmseqs-web-backend
linux: resources/linux/arm64/${FRONTEND_APP} resources/linux/x64/${FRONTEND_APP} resources/linux/arm64/mmseqs-web-backend resources/linux/x64/mmseqs-web-backend

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

resources/mac/${FRONTEND_APP}:
	mkdir -p resources/mac
	wget -nv -q -O - https://mmseqs.com/archive/$(hash)/${FRONTEND_APP}-osx-universal.tar.gz | tar -xOf - ${FRONTEND_APP}/bin/${FRONTEND_APP} > resources/mac/${FRONTEND_APP}
	chmod +x resources/mac/${FRONTEND_APP}

resources/mac/x64/${FRONTEND_APP}: resources/mac/${FRONTEND_APP}
	mkdir -p resources/mac/x64
	$(LIPO) resources/mac/${FRONTEND_APP} -remove arm64 -output resources/mac/x64/${FRONTEND_APP} || cp -f -- resources/mac/${FRONTEND_APP} resources/mac/x64/${FRONTEND_APP}

resources/mac/arm64/${FRONTEND_APP}: resources/mac/${FRONTEND_APP}
	mkdir -p resources/mac/arm64
	$(LIPO) resources/mac/${FRONTEND_APP} -thin arm64 -output resources/mac/arm64/${FRONTEND_APP} || cp -f -- resources/mac/${FRONTEND_APP} resources/mac/arm64/${FRONTEND_APP}

resources/linux/x64/${FRONTEND_APP}-sse41:
	mkdir -p resources/linux/x64
	wget -nv -q -O - https://mmseqs.com/archive/$(hash)/${FRONTEND_APP}-linux-sse41.tar.gz | tar -xOf - ${FRONTEND_APP}/bin/${FRONTEND_APP} > resources/linux/x64/${FRONTEND_APP}-sse41
	chmod +x resources/linux/x64/${FRONTEND_APP}-sse41

resources/linux/x64/${FRONTEND_APP}-avx2:
	mkdir -p resources/linux/x64
	wget -nv -q -O - https://mmseqs.com/archive/$(hash)/${FRONTEND_APP}-linux-avx2.tar.gz | tar -xOf - ${FRONTEND_APP}/bin/${FRONTEND_APP} > resources/linux/x64/${FRONTEND_APP}-avx2
	chmod +x resources/linux/x64/${FRONTEND_APP}-avx2

resources/linux/x64/${FRONTEND_APP}: electron/${FRONTEND_APP}-wrapper.sh resources/linux/x64/${FRONTEND_APP}-avx2 resources/linux/x64/${FRONTEND_APP}-sse41
	cp electron/${FRONTEND_APP}-wrapper.sh resources/linux/x64/${FRONTEND_APP}
	chmod +x resources/linux/x64/${FRONTEND_APP}

resources/linux/arm64/${FRONTEND_APP}:
	mkdir -p resources/linux/arm64
	wget -nv -q -O - https://mmseqs.com/archive/$(hash)/${FRONTEND_APP}-linux-arm64.tar.gz | tar -xOf - ${FRONTEND_APP}/bin/${FRONTEND_APP} > resources/linux/arm64/${FRONTEND_APP}
	chmod +x resources/linux/arm64/${FRONTEND_APP}

resources/win/x64/${FRONTEND_APP}.bat:
	mkdir -p resources/win/x64
	cd resources/win/x64 && wget -nv -O ${FRONTEND_APP}-win64.zip https://mmseqs.com/archive/$(hash)/${FRONTEND_APP}-win64.zip \
		&& unzip ${FRONTEND_APP}-win64.zip && mv ${FRONTEND_APP}/* . && rmdir ${FRONTEND_APP} && rm ${FRONTEND_APP}-win64.zip
	chmod -R +x resources/win/x64/${FRONTEND_APP}.bat resources/win/x64/bin/*

clean:
	@rm -f build/icon.icns build/icon.ico
	@rm -rf resources/mac/* resources/linux/* resources/win/*
