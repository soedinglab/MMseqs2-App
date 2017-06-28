#!/bin/bash -e
docker build -t eggnog .
docker run -v $(readlink -f ../databases):/opt/mmseqs-web/databases --rm -i -t eggnog build_eggnog.sh 
