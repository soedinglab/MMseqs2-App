#!/bin/bash -e
SELF="$(dirname "$(readlink -f "$0")")"
NAME=PDB70
VERSION=latest

mkdir -p databases
wget "http://wwwuser.gwdg.de/~compbiol/data/hhsuite/databases/hhsuite_dbs/pdb70_from_mmcif_${VERSION}.tar.gz" -O - \
    | tar -xOzf - pdb70_a3m.ffdata | tr -d '\000'| awk -v outfile="databases/pdb70_${VERSION}_msa" -f "${SELF}/pdb70.awk"
awk 'BEGIN { printf("%c%c%c%c",11,0,0,0); exit; }' > "databases/pdb70_${VERSION}_msa.dbtype"

echo -e "{\n  \"name\": \"$NAME\",\n  \"version\": \"$VERSION\",\n  \"default\": true,\n  \"order\": 0,\n  \"index\": \"-s 6\",\n  \"search\": \"-s 6\"\n}\n" > "databases/pdb70_${VERSION}.params"
