#!/bin/bash -e
NAME="Uniclust"
VERSION="2017_04"
SEQID="30"
KIND="seed"

wget "http://gwdu111.gwdg.de/~compbiol/uniclust/${VERSION}/uniclust30_${VERSION}.tar.gz" | tar -xzvf - "uniclust30_${VERSION}_${KIND}.fasta"
echo -e "{\n \"display\": {\n  \"name\": \"$NAME\",\n  \"version\": \"$VERSION\",\n  \"default\": true,\n  \"order\": 0\n },\n \"params\": {\n  \"search\": \"-s 5\"\n }\n}" > "uniclust30_${VERSION}_${KIND}.params"
