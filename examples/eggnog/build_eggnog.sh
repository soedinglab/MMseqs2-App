#!/bin/bash -e
cd /opt/mmseqs-web/databases
mkdir -p eggnog_build/tmp && cd eggnog_build/tmp
curl http://eggnogdb.embl.de/download/eggnog_4.5/data/NOG/NOG.trimmed_algs.tar.gz | tar --strip-components=1 -xzf -
ffindex_build -s ../eggnog_4.5_fas ../eggnog_4.5_fas.index .
cd .. && rm -rf tmp
awk '{ match($1, /^NOG\.([^\.]+)\./, res); print res[1]"\t"$2"\t"$3 }' eggnog_4.5_fas.index > eggnog_4.5_fas.index.tmp && mv -f eggnog_4.5_fas.index.tmp eggnog_4.5_fas.index
mpirun --allow-run-as-root ffindex_apply_mpi -q -d ../eggnog_4.5_msa -i ../eggnog_4.5_msa.index eggnog_4.5_fas eggnog_4.5_fas.index -- apply_eggnog.sh
cd .. && rm -rf eggnog_build
