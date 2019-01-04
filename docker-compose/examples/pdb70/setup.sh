#!/bin/bash -e
SELF="$(dirname "$(readlink -f "$0")")"
NAME=PDB70
VERSION=190102

mkdir -p databases
curl "http://wwwuser.gwdg.de/~compbiol/data/hhsuite/databases/hhsuite_dbs/pdb70_from_mmcif_${VERSION}.tar.gz" \
    | tar -xOzf - pdb70_a3m.ffdata | tr -d '\000'| awk -v outfile="databases/pdb70_${VERSION}_msa" -f "${SELF}/pdb70.awk"

echo -e "{\n \"display\": {\n  \"name\": \"$NAME\",\n  \"version\": \"$VERSION\",\n  \"default\": true,\n  \"order\": 0,\n  \"search\": \"-s 6\"\n }\n}\n" > "databases/pdb70_${VERSION}.params"
