.PHONY: all clean

all: build/icons/256x256.png build/icons/icon.icns build/icons/icon.ico dist/electron/mmseqs-web-backend-osx dist/electron/mmseqs-web-backend-linux dist/electron/mmseqs-web-backend-windows.exe

build/icons/256x256.png:
	./node_modules/.bin/svg2png src/renderer/src/assets/marv1-square.svg --output=build/icons/256x256.png --width=256 --height=256

build/icons/icon.icns:
	./node_modules/.bin/icon-gen -i src/renderer/src/assets/marv1-square.svg -o build/icons/ -m icns -n icns=icon

build/icons/icon.ico:
	./node_modules/.bin/icon-gen -i src/renderer/src/assets/marv1-square.svg -o build/icons/ -m ico -n ico=icon

export GOPATH:=$(abspath ./src/backend/)
dist/electron/mmseqs-web-backend-osx: 
	cd ./src/backend/src/github.com/milot-mirdita/mmseqs-web-backend && govendor sync && cd -
	GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build -o dist/electron/mmseqs-web-backend-osx github.com/milot-mirdita/mmseqs-web-backend

dist/electron/mmseqs-web-backend-linux:
	cd ./src/backend/src/github.com/milot-mirdita/mmseqs-web-backend && govendor sync && cd -
	GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o dist/electron/mmseqs-web-backend-linux github.com/milot-mirdita/mmseqs-web-backend

dist/electron/mmseqs-web-backend-windows.exe:
	cd ./src/backend/src/github.com/milot-mirdita/mmseqs-web-backend && govendor sync && cd -
	GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build -o dist/electron/mmseqs-web-backend-windows.exe github.com/milot-mirdita/mmseqs-web-backend

clean:
	rm -f build/icons/256x256.png build/icons/icon.icns build/icons/icon.ico
	rm -f dist/electron/mmseqs-web-backend-osx dist/electron/mmseqs-web-backend-linux dist/electron/mmseqs-web-backend-windows.exe
