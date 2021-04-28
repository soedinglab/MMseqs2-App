#!/bin/bash -e
NAME="Uniclust"
VERSION="2020_06"
SEQID="30"
KIND="seed"

mkdir -p databases
(cd databases; curl "http://gwdu111.gwdg.de/~compbiol/uniclust/${VERSION}/uniclust30_${VERSION}.tar.gz" | tar --strip-components=1 -xzvf - "uniclust30_${VERSION}/uniclust30_${VERSION}_${KIND}.fasta"; rm -f "uniclust30_${VERSION}.tar.gz")
echo -e "{\n  \"name\": \"${NAME}${SEQID}\",\n  \"version\": \"$VERSION\",\n  \"default\": true,\n  \"order\": 0,\n  \"index\": \"-s 5.7\",\n  \"search\": \"-s 5.7\"\n}" > "databases/uniclust${SEQID}_${VERSION}_${KIND}.params"

