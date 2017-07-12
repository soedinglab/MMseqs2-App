#!/bin/bash -e
NAME=PFAM
VERSION=31.0
curl "http://wwwuser.gwdg.de/~compbiol/data/hhsuite/databases/hhsuite_dbs/pfamA_${VERSION}.tgz" | tar -xzvf - pfam_a3m.ffdata
tr -d '\000' < pfam_a3m.ffdata | awk -v outfile=pfam_${VERSION}_msa -f pfam.awk
rm -f pfam_a3m.ffdata
echo -e "{\n \"display\": {\n  \"name\": \"$NAME\",\n  \"version\": \"$VERSION\",\n  \"default\": true,\n  \"order\": 0\n },\n \"params\": {\n  \"search\": \"-s 5\"\n }\n}" > "pfam_${VERSION}.params"
