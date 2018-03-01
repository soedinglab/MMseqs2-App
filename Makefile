.PHONY: all clean

all: build/icons/256x256.png build/icons/icon.icns build/icons/icon.ico \
	 dist/electron/bin/mmseqs-web-backend-osx dist/electron/bin/mmseqs-web-backend-linux dist/electron/bin/mmseqs-web-backend-windows.exe \
	 dist/electron/bin/cpu-check-darwin dist/electron/bin/cpu-check-linux dist/electron/bin/cpu-check-windows.exe \
	 dist/electron/bin/config.json

build/icons/256x256.png:
	./node_modules/.bin/svg2png src/renderer/src/assets/marv1-square.svg --output=build/icons/256x256.png --width=256 --height=256

build/icons/icon.icns:
	./node_modules/.bin/icon-gen -i src/renderer/src/assets/marv1-square.svg -o build/icons/ -m icns -n icns=icon

build/icons/icon.ico:
	./node_modules/.bin/icon-gen -i src/renderer/src/assets/marv1-square.svg -o build/icons/ -m ico -n ico=icon

CURRDIRR := $(shell greadlink -f . || readlink -f . )
dist/electron/bin/mmseqs-web-backend-osx:
	cd src/backend/ && GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 BINPATH=$(CURRDIRR)/dist/electron/bin/mmseqs-web-backend-darwin       make all

dist/electron/bin/mmseqs-web-backend-linux:
	cd src/backend/ && GOOS=linux  GOARCH=amd64 CGO_ENABLED=0 BINPATH=$(CURRDIRR)/dist/electron/bin/mmseqs-web-backend-linux        make all

dist/electron/bin/mmseqs-web-backend-windows.exe:
	cd src/backend/ && GOOS=windows GOARCH=amd64 CGO_ENABLED=0 BINPATH=$(CURRDIRR)/dist/electron/bin/mmseqs-web-backend-windows.exe make all

dist/electron/bin/config.json: src/backend/build/config.json
	cp src/backend/build/config.json dist/electron/bin/config.json

dist/electron/bin/cpu-check-darwin: src/main/lib/simdlevel/cpu-check-darwin 
	cp src/main/lib/simdlevel/cpu-check-darwin dist/electron/bin/cpu-check-darwin

dist/electron/bin/cpu-check-linux: src/main/lib/simdlevel/cpu-check-linux 
	cp src/main/lib/simdlevel/cpu-check-linux dist/electron/bin/cpu-check-linux

dist/electron/bin/cpu-check-windows.exe: src/main/lib/simdlevel/cpu-check-windows.exe 
	cp src/main/lib/simdlevel/cpu-check-windows.exe dist/electron/bin/cpu-check-windows.exe

clean:
	rm -f build/icons/256x256.png build/icons/icon.icns build/icons/icon.ico
	rm -f dist/electron/bin/mmseqs-web-backend-osx dist/electron/bin/mmseqs-web-backend-linux dist/electron/bin/mmseqs-web-backend-windows.exe
