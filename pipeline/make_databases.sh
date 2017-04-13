#!/bin/bash -ex

function abspath() {
    if [ -d "$1" ]; then
        (cd "$1"; pwd)
    elif [ -f "$1" ]; then
        if [[ $1 == */* ]]; then
            echo "$(cd "${1%/*}"; pwd)/${1##*/}"
        else
            echo "$(pwd)/$1"
        fi
    elif [ -d $(dirname "$1") ]; then
        echo "$(cd $(dirname "$1"); pwd)/$(basename "$1")"
    fi
}

function make_database_from_fasta() {
	local INPUT="$(abspath $1)"
	local OUTPUT="$(abspath $2)"

	local SPLIT="--split 1"
	while getopts ":x" opt; do
		case $opt in
			x)
				SPLIT=""
				;;
			\?)
				echo "Invalid option: -$OPTARG" >&2
				;;
		esac
	done

	"${MMSEQS}" createdb "${FASTA}" "${OUTPUT}"
	"${MMSEQS}" createindex "${OUTPUT}" --mask 2 ${SPLIT}
    printf "%s\n%s\n%s\n" \
            '#!/bin/bash' \
            "export SEARCH_PARAMS=\"\"" \
            "export SPLIT=\"${SPLIT}\"" \
        > "${OUTPUT}.params"
}

function make_database_from_db() {
	local INPUTDATA="$(abspath $1)"
	local INPUTINDEX="$(abspath $2)"
	local OUTPUT="$(abspath $3)"

	local MAXSENS="4"
	local MPIPROCS="2"
	local SPLIT="--split 1"
	while getopts ":s:p:x" opt; do
		case $opt in
			s)
				MAXSENS="$OPTARG"
				;;
			p)
				MPIPROCS="$OPTARG"
				;;
			x)
				SPLIT=""
			\?)
				echo "Invalid option: -$OPTARG" >&2
				;;
		esac
	done

	if [[ $MPIPROCS -lt 2 ]]; then
		MPIPROCS=2
	fi
	mpirun -np "${MPIPROCS}" ffindex_apply_mpi -d "${OUTPUT}_hhm" -i "${OUTPUT}_hhm.index" \
		"${INPUTDATA}" "${INPUTINDEX}" \
		-- hhmake -i stdin -o stdout -pcm 2 -nocontxt -v 0

	grep -v -E '[[:space:]][0-1]$' "${OUTPUT}_hhm.index" \
		> "${OUTPUT}_hhm.index_nobroken"

	sort -k2,2 -n "${OUTPUT}_hhm.index_nobroken" \
		| awk -v outfile="${OUTPUT}.lookup" \
			'{ n=n+1; print n"\t"$2"\t"$3; print n"\t"$1 >> outfile; }' \
			> "${OUTOUT}_hhm.index"

	"${MMSEQS}" convertprofiledb "${OUTPUT}_hhm" "${OUTPUT}"
	"${MMSEQS}" createindex "${OUTPUT}" -s "${MAXSENS}" ${SPLIT} --target-profile

    printf "%s\n%s\n%s\n%s\n" \
            '#!/bin/bash' \
            "export SEARCH_PARAMS=\"-s ${MAXSENS}\"" \
            "export SPLIT=\"${SPLIT}\"" \
            'export PROFILE=1' \
        > "${OUTPUT}.params"

	rm -f "${OUTPUT}_hhm" "${OUTPUT}_hhm.index" "${OUTPUT}_hhm.index_nobroken"
}

