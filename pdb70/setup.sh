#!/bin/bash
VERSION=28Jun17
curl "http://wwwuser.gwdg.de/~compbiol/data/hhsuite/databases/hhsuite_dbs/pdb70_from_mmcif_${VERSION}.tgz" | tar -xzvf - pdb70_a3m.ffdata
tr -d '\000' < pdb70_a3m.ffdata | awk -v outfile=pdb70_${VERSION}_msa -f pdb70.awk 
