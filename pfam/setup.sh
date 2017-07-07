#!/bin/bash -e
VERSION=31.0
curl "http://wwwuser.gwdg.de/~compbiol/data/hhsuite/databases/hhsuite_dbs/pfamA_${VERSION}.tgz" | tar -xzvf - pfam_a3m.ffdata
tr -d '\000' < pfam_a3m.ffdata | awk -v outfile=pfam_${VERSION}_msa -f pfam.awk
