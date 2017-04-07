#!/bin/bash -ex
source "$(dirname $(cd $(dirname ${BASH_SOURCE}) && pwd))/paths.sh"

function fail() {
    echo "$1"
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

function notify_job() {
    echo TODO implement
}

function queue_email() {
    echo TODO implement
}

function run_job() {
    local JOBID="$1"
    local WORKDIR="$(abspath "${WORKBASE}/${JOBID}")"
    local JOBTHREADS="16"

    if [[ -d $WORKDIR ]]; then
        fail "${JOBID}" "job directory already exists" "${WORKDIR}"
    else
        mkdir -p "${WORKDIR}"
    fi

    local MMTMP="${WORKDIR}/tmp"
    mkdir -p "${MMTMP}"

	local QUERYFASTA="$(abspath $2)"
	local QUERYDB="${WORKDIR}/input"

    local SEQIDS="${3:-"30"}"
    local ANNOTATION_DATABASES="${4:-"pfam pdb70 eggnog"}"

    local ALIS=()
    local TYPES=()

    local INPUT="${QUERYDB}"

    "${MMSEQS}" createdb "${QUERYFASTA}" "${QUERYDB}" -v 0 \
        || fail "createdb failed"

    if [[ -n ${SEQIDS} ]]; then
        for SEQID in ${SEQIDS}; do
            mkdir -p "${MMTMP}/${SEQID}"
            "${MMSEQS}" search "${QUERYDB}" "${DATABASES}/current_uniclust${SEQID}" "${WORKDIR}/result_uniclust${SEQID}" "${MMTMP}/${SEQID}" \
                --no-preload --early-exit --remove-tmp-files --split-mode 1 -a -v 0 --threads "${JOBTHREADS}" \
                -s 1 \
                || fail "search failed"

            ALIS+=("${QUERYDB} ${DATABASES}/current_uniclust${SEQID} ${WORKDIR}/result_uniclust${SEQID}")
            TYPES+=("uc${SEQID}")
            # maybe later when we have profile-profile searches
            #INPUT="${WORKDIR}/result_uc"
        done

        notify_job "${JOBID}" UNICLUST_DONE
    fi

    if [[ -n ${ANNOTATION_DATABASES} ]]; then
        for i in ${ANNOTATION_DATABASES}; do
            mkdir -p "${MMTMP}/${i}"
            "${MMSEQS}" search "${INPUT}" "${DATABASES}/current_${i}" "${WORKDIR}/result_${i}" "${MMTMP}/${i}" \
                --no-preload --early-exit --remove-tmp-files --split-mode 1 -a -v 0 --threads "${JOBTHREADS}" \
                --target-profile -s 1 \
                || fail "search failed" 

            ALIS+=("${QUERYDB} ${DATABASES}/current_${i} ${WORKDIR}/result_${i}")
            TYPES+=("${i}")
        done

        notify_job "${JOBID}" ANNOTATIONS_DONE
    fi

    if (( $(head -n 2 "${QUERYDB}.index" | wc -l) == 1 )); then
        exit 0
    fi

    if (( ${#ALIS[@]} > 0 )); then
        local M8S=""
        for i in "${!ALIS[@]}"; do
            local M8="${WORKDIR}/${JOBID}_${TYPES[$i]}.m8"
            "${MMSEQS}" convertalis ${ALIS[$i]} "${M8}" \
                || fail "convertalis failed"
            M8S="${M8S} ${M8}"
        done

        tar -cv --use-compress-program=pigz \
            --show-transformed-names --transform "s|${WORKDIR:1}/|mmseqs_results_${JOBID}/|g" \
            -f "${WORKDIR}/mmseqs_results_${JOBID}.tar.gz" ${M8S}

        queue_email "${JOBID}"
    fi
}

run_job "$1" "$2" "$3" "$4"
