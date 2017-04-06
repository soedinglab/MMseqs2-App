#!/bin/bash -ex
MMSEQS="mmseqs"
BASE="/cbscratch/mmirdit/mmseqs-webserver"
WORKBASE="${BASE}/jobs"
DATABASES="${BASE}/databases"
JOBTHREADS="16"

PATH="${BASE}/pipeline/mmseqs/bin:$PATH"

function fail() {
    notify_job "$1" ERROR
    echo "$2" > "$3/error.log"
    exit 1
}

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

function make_database() {
    local WORKDIR="$(mktemp -d "${WORKBASE}/merge.XXXXXX")"
	local FASTA="$(abspath $1)"
	local FASTABASE="$(basename "$FASTA")"
	local DBNAME="${FASTABASE%.*}"

	"${MMSEQS}" createdb "${FASTA}" "${WORKDIR}/${DBNAME}_db"
	"${MMSEQS}" createindex "${WORKDIR}/${DBNAME}_db" --mask 2 --split 1
	mv -f "${WORKDIR}/${DBNAME}_db"* "${DATABASES}"
}

function notify_job() {
    echo TODO implement
}

function queue_email() {
    echo TODO implement
}

function force_dbs_page_cache() {
    echo TODO implement
}

function run_job() {
    local JOBID="$1"
    local WORKDIR="$(abspath "${WORKBASE}/${JOBID}")"
    local ANNOTATION_DATABASES="pfam pdb70 eggnog"

    if [[ -d $WORKDIR ]]; then
        fail "${JOBID}" "job directory already exists" "${WORKDIR}"
    else
        mkdir -p "${WORKDIR}"
    fi

    local MMTMP="$(mktemp -d "${WORKDIR}/tmp.XXXXXX")"
	local QUERYFASTA="$(abspath $2)"
	local QUERYDB="${WORKDIR}/input"

    local DATABASE="${DATABASES}/$3"

    local ALIS=()
    local TYPES=()

    local INPUT="${QUERYDB}"

    "${MMSEQS}" createdb "${QUERYFASTA}" "${QUERYDB}" -v 0 \
        || fail "${JOBID}" "createdb failed" "${WORKDIR}"

    #if [[ ! -z ${ANNOTATIONS_ONLY} ]]; then
    if true; then
        "${MMSEQS}" search "${QUERYDB}" "${DATABASE}" "${WORKDIR}/result_uc" "${MMTMP}" \
            --no-preload --early-exit --remove-tmp-files --split-mode 1 -a -v 0 --threads "${JOBTHREADS}" \
            -s 1 \
            || fail "${JOBID}" "search failed" "${WORKDIR}"

        ALIS+=("${QUERYDB} ${DATABASE} ${WORKDIR}/result_uc")
        TYPES+=("uc")
        notify_job "${JOBID}" SEARCH_DONE
		# maybe later when we have profile-profile searches
        #INPUT="${WORKDIR}/result_uc"
    fi

    for i in ${ANNOTATION_DATABASES}; do
        mkdir -p "${MMTMP}/${i}"
        "${MMSEQS}" search "${INPUT}" "${DATABASES}/current_${i}" "${WORKDIR}/result_${i}" "${MMTMP}/${i}" \
            --no-preload --early-exit --remove-tmp-files --split-mode 1 -a -v 0 --threads "${JOBTHREADS}" \
            --target-profile -s 1 \
            || fail "${JOBID}" "search failed" "${WORKDIR}"

        #ALIS+=("\"${QUERYDB}\" \"${DATABASES}/current_${i}\" \"${WORKDIR}/result_${i}\"")
        ALIS+=("${QUERYDB} ${DATABASES}/current_${i} ${WORKDIR}/result_${i}")
        TYPES+=("${i}")
    done

    notify_job "${JOBID}" ANNOTATIONS_DONE

    if (( $(head -n 2 "${QUERYDB}.index" | wc -l) == 1 )); then
        exit 0
    fi

    local M8S=""
    for i in "${!ALIS[@]}"; do
        local M8="${WORKDIR}/${JOBID}_${TYPES[$i]}.m8"
        mmseqs convertalis ${ALIS[$i]} "${M8}"
        M8S="${M8S} ${M8}"
    done

    tar -cv --use-compress-program=pigz \
        --show-transformed-names --transform "s|${WORKDIR:1}/|mmseqs_results_${JOBID}/|g" \
        -f "${WORKDIR}/mmseqs_results_${JOBID}.tar.gz" ${M8S}

	queue_email "${JOBID}"
}

#make_database /cbscratch/mmirdit/uniclust/pipeline/sprot_trembl_martin/2017_02/tmp/uniclust30_2017_02_seed.fasta
#make_database /cbscratch/mmirdit/uniclust/pipeline/sprot_trembl_martin/2017_02/tmp/uniclust90_2017_02_seed.fasta

run_job TEST /cbscratch/mmirdit/mmseqs-webserver/pipeline/QUERY.fasta uniclust30_2017_02_seed_db 
