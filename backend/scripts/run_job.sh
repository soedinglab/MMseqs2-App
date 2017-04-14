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
    "${REDISCLI}" set "mmseqs:status:$1" "{ \"status\": \"$2\" }"
}

function send_mail() {
	curl -s --user 'api:key-ef51bf0689b99e7aaa73942306e9adff' \
		https://api.mailgun.net/v3/mail.mmseqs.com/messages \
		-F from='MMseqs Search Service <mailgun@mail.mmseqs.com>' \
		-F to="$1" \
		-F subject="$2" \
		-F text="$3"
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

    local TARGETS="$3"
    local MODE="$4"
    local ACCEPT=""
    local EVAl=""

    case "${MODE}" in
        accept)
            ACCEPT="--max-accept $5"
            ;;

        summary)
            EVAl="$6"
            ;;

        *)
            echo "Invalid mode!"
            exit 1
            ;;

    esac

    "${MMSEQS}" createdb "${QUERYFASTA}" "${QUERYDB}" -v 0 \
        || fail "createdb failed"

    local ALIS=""
    local MSAS=""
    local M8S=""
    local SKIPQUERY=""
    for DB in ${TARGETS}; do
        mkdir -p "${MMTMP}/${DB}"

        local SEARCH_PARAMS=""
        local MSA_PARAMS=""
        local ALIS_PARAMS=""

        if [[ -f "${DATABASES}/${DB}.params" ]]; then
            source "${DATABASES}/${DB}.params";
        fi

        INPUT="${WORKDIR}/result_${DB}"
        PROFPARAM=""
        if [[ ! -z "$PROFILE" ]]; then
            PROFPARAM="--target-profile"
        fi  
        "${MMSEQS}" search "${QUERYDB}" "${DATABASES}/${DB}" \
                "${INPUT}" "${MMTMP}/${DB}" \
                --no-preload --early-exit --remove-tmp-files \
                --split-mode 1 -a -v 0 --threads "${JOBTHREADS}" \
                ${SEARCH_PARAMS} ${PROFPARAM} ${ACCEPT} \
            || fail "search failed"
        
        local SEQDB="${DATABASES}/${DB}"
        if [[ ! -z "$PROFILE" ]]; then
            SEQDB="${DATABASES}/${DB}_seq"
        fi

        if [[ ! -z "$EVAL" ]]; then
            "${MMSEQS}" summarizeresult "${INPUT}" "${WORKDIR}/summarized_${DB}" \
                    -a -e "${EVAL}" -v 0 --threads "${JOBTHREADS}"
                || fail "summarizeresult failed"
            INPUT="${WORKDIR}/summarized_${DB}"
        fi

        local MSA="${WORKDIR}/msa_${DB}"
        "${MMSEQS}" result2msa "${QUERYDB}" "${SEQDB}" \
                "${INPUT}" "${MSA}" \
                -v 0 --threads "${JOBTHREADS}" \
                ${MSA_PARAMS} ${SKIPQUERY} \
            || fail "result2msa failed"
        MSAS="${MSAS} ${MSA}"

        local ALI="${WORKDIR}/alis_${DB}"
        "${MMSEQS}" convertalis "${QUERYDB}" "${SEQDB}" \
                "${WORKDIR}/result_${DB}" "${ALI}" \
                --no-preload --early-exit --db-output -v 0 \
                --threads "${JOBTHREADS}" ${ALIS_PARAMS} \
            || fail "convertalis failed"

        ALIS="${ALIS} ${ALI}"

        rm -f "${WORKDIR}/result_${DB}" "${WORKDIR}/result_${DB}.index"

        local M8="${WORKDIR}/${JOBID}_${DB}.m8"
        tr -d '\000' < "${WORKDIR}/alis_${DB}" > "${M8}"
        M8S="${M8S} ${M8}"     
        SKIPQUERY="--skip-query"
    done

    "${MMSEQS}" mergedbs "${QUERYDB}" "${WORKDIR}/msa" ${MSAS}
    for i in ${MSAS}; do
        rm -f "${i}" "${i}.index"
    done

    "${MMSEQS}" mergedbs "${QUERYDB}" "${WORKDIR}/alis" ${ALIS}
    for i in ${ALIS}; do
        rm -f "${i}" "${i}.index"
    done

    tar -cv --use-compress-program=pigz \
        --show-transformed-names --transform "s|${WORKDIR:1}/|mmseqs_results_${JOBID}/|g" \
        -f "${WORKDIR}/mmseqs_results_${JOBID}.tar.gz" ${M8S}

    rm -f ${M8S}

    #send_email "${JOBID}"
}

run_job "$1" "$2" "$3" "$4" "$5" "$6"
