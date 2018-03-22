.PHONY: all clean

all: build/icons/256x256.png build/icons/icon.icns build/icons/icon.ico \
	win mac linux

win: resources/win/mmseqs.bat resources/win/mmseqs-web-backend.exe resources/win/cpu-check.exe

mac: resources/mac/mmseqs-sse41 resources/mac/mmseqs-avx2 resources/mac/mmseqs-web-backend resources/mac/cpu-check

linux: resources/linux/mmseqs-sse41 resources/linux/mmseqs-avx2 resources/linux/mmseqs-web-backend resources/linux/cpu-check

build/icons/256x256.png:
	./node_modules/.bin/svg2png src/renderer/src/assets/marv1-square.svg --output=build/icons/256x256.png --width=256 --height=256

build/icons/icon.icns:
	./node_modules/.bin/icon-gen -i src/renderer/src/assets/marv1-square.svg -o build/icons/ -m icns -n icns=icon

build/icons/icon.ico:
	./node_modules/.bin/icon-gen -i src/renderer/src/assets/marv1-square.svg -o build/icons/ -m ico -n ico=icon

CURRDIRR := $(shell greadlink -f . || readlink -f . )
resources/mac/mmseqs-web-backend:
	cd resources/src/backend/ && GOOS=darwin GOARCH=amd64  CGO_ENABLED=0 BINPATH=$(CURRDIRR)/resources/mac/mmseqs-web-backend make all

resources/linux/mmseqs-web-backend:
	cd resources/src/backend/ && GOOS=linux  GOARCH=amd64  CGO_ENABLED=0 BINPATH=$(CURRDIRR)/resources/linux/mmseqs-web-backend  make all

resources/win/mmseqs-web-backend.exe:
	cd resources/src/backend/ && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 BINPATH=$(CURRDIRR)/resources/win/mmseqs-web-backend.exe make all

resources/mac/cpu-check:
	cd resources/src/cpu-check/ && GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(CURRDIRR)/resources/mac/cpu-check

resources/linux/cpu-check:
	cd resources/src/cpu-check/ && GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(CURRDIRR)/resources/linux/cpu-check

resources/win/cpu-check.exe:
	cd resources/src/cpu-check/ && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -ldflags="-s -w" -o $(CURRDIRR)/resources/win/cpu-check.exe

resources/mac/mmseqs-sse41:
	cd resources/mac && wget https://mmseqs.com/latest/mmseqs-osx-static_sse41.tar.gz -O mmseqs.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs/bin/mmseqs && mv mmseqs mmseqs-sse41 && rm mmseqs.tar.gz

resources/mac/mmseqs-avx2:
	cd resources/mac && wget https://mmseqs.com/latest/mmseqs-osx-static_avx2.tar.gz -O mmseqs.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs/bin/mmseqs && mv mmseqs mmseqs-avx2 && rm mmseqs.tar.gz

resources/linux/mmseqs-sse41:
	cd resources/linux && wget https://mmseqs.com/latest/mmseqs-static_sse41.tar.gz -O mmseqs.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs2/bin/mmseqs && mv mmseqs mmseqs-sse41 && rm mmseqs.tar.gz

resources/linux/mmseqs-avx2:
	cd resources/linux && wget https://mmseqs.com/latest/mmseqs-static_avx2.tar.gz -O mmseqs.tar.gz \
		&& tar --strip-components=2 -xf mmseqs.tar.gz mmseqs2/bin/mmseqs && mv mmseqs mmseqs-avx2 && rm mmseqs.tar.gz

resources/win/mmseqs.bat:
	cd resources/win && wget https://mmseqs.com/latest/mmseqs-win64.zip && unzip mmseqs-win64.zip && mv mmseqs/* . && rmdir mmseqs && rm mmseqs-win64.zip

clean:
	#rm -f build/icons/256x256.png build/icons/icon.icns build/icons/icon.ico
	rm -f resources/mac/* resources/linux/*  resources/win/*
