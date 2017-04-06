#!/bin/bash -e
TYPE=${1:-Release}

OUTDIR=/cbscratch/mmirdit/mmseqs-webserver/pipeline/mmseqs
REPO=/cbscratch/mmirdit/mmseqs
rm -rf $OUTDIR
mkdir $OUTDIR
cd $OUTDIR

cmake -G Ninja -DHAVE_TESTS=0 -DHAVE_MPI=0 -DCMAKE_INSTALL_PREFIX=$OUTDIR -DCMAKE_BUILD_TYPE=$TYPE $REPO
ninja install
