#!/bin/bash
NAME=PDB70
VERSION=28Jun17
curl "http://wwwuser.gwdg.de/~compbiol/data/hhsuite/databases/hhsuite_dbs/pdb70_from_mmcif_${VERSION}.tgz" | tar -xzvf - pdb70_a3m.ffdata
tr -d '\000' < pdb70_a3m.ffdata | awk -v outfile=pdb70_${VERSION}_msa -f pdb70.awk 
rm -f pdb70_a3m.ffdata
echo -e "{\n \"display\": {\n  \"name\": \"$NAME\",\n  \"version\": \"$VERSION\",\n  \"default\": true,\n  \"order\": 0\n },\n \"params\": {\n  \"search\": \"-s 5\"\n }\n}" > "pdb70_${VERSION}.params"
