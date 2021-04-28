#!/bin/bash -e
NAME=PFAM
VERSION=34.0

mkdir -p databases
curl -o databases/Pfam-A_${VERSION}.sto.gz ftp://ftp.ebi.ac.uk/pub/databases/Pfam/releases/Pfam${VERSION}/Pfam-A.full.gz
gunzip databases/Pfam-A_${VERSION}.sto.gz
echo -e "{\n  \"name\": \"$NAME\",\n  \"version\": \"$VERSION\",\n  \"default\": true,\n  \"order\": 0,\n  \"index\": \"-s 6\",\n  \"search\": \"-s 6\"\n}" > "databases/Pfam-A_${VERSION}.params"
