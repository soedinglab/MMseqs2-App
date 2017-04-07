#!/bin/bash -e
TYPE=${1:-Release}

OUTDIR=/big/search.mmseqs.org/mmseqs
REPO=/big/mmirdit/mmseqs
rm -rf $OUTDIR
mkdir $OUTDIR
cd $OUTDIR

cmake -G Ninja -DHAVE_TESTS=0 -DHAVE_MPI=0 -DCMAKE_INSTALL_PREFIX=$OUTDIR -DCMAKE_BUILD_TYPE=$TYPE $REPO
ninja install
