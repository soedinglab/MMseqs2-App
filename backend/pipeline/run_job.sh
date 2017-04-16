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

function json2export() {
    jq -r 'paths(scalars) as $p | ($p | join("_") | ascii_upcase) as $k | getpath($p) | tostring as $v | "export " + $k + "=" + "\"" + $v + "\""'
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
        fail "job directory already exists" "${WORKDIR}"
    else
        mkdir -p "${WORKDIR}"
    fi

    local MMTMP="${WORKDIR}/tmp"
    mkdir -p "${MMTMP}"

	local QUERYFASTA="$(abspath $2)"
	local QUERYDB="${WORKDIR}/input"

    local TARGETS="$3"

    local MODE="$4"
    case "${MODE}" in
        accept)
            ;;
        summary)
            ;;
        *)
            fail "Invalid mode!"
            ;;
    esac

    local EMAIL="$5"

    "${MMSEQS}" createdb "${QUERYFASTA}" "${QUERYDB}" -v 0 \
        || fail "createdb failed"

    local ALIS=""
    local MSAS=""
    local M8S=""
    local SKIPQUERY=""
    for DB in ${TARGETS}; do
        mkdir -p "${MMTMP}/${DB}"

        local PARAMS_SEARCH=""
        local PARAMS_SUMMARIZERESULT=""
        local PARAMS_RESULT2MSA=""
        local PARAMS_CONVERTALIS=""

        if [[ -f "${DATABASES}/${DB}.params" ]]; then
            eval "$(cat ${DATABASES}/${DB}.params | json2export)";
        fi

        INPUT="${WORKDIR}/result_${DB}"
        "${MMSEQS}" search "${QUERYDB}" "${DATABASES}/${DB}" \
                "${INPUT}" "${MMTMP}/${DB}" \
                --no-preload --early-exit --remove-tmp-files \
                --split-mode 1 -a -v 0 --threads "${JOBTHREADS}" \
                ${PARAMS_SEARCH} \
            || fail "search failed"
        
        local SEQDB="${DATABASES}/${DB}"
        if [[ -f "${DATABASES}/${DB}_seq" ]]; then
            SEQDB="${DATABASES}/${DB}_seq"
        fi

        if [[ "${MODE}" -eq "summary" ]]; then
            "${MMSEQS}" summarizeresult "${INPUT}" "${WORKDIR}/summarized_${DB}" \
                    -a -v 0 --threads "${JOBTHREADS}" \
                    ${PARAMS_SUMMARIZERESULT} \
                || fail "summarizeresult failed"
            INPUT="${WORKDIR}/summarized_${DB}"
        fi

        local MSA="${WORKDIR}/msa_${DB}"
        "${MMSEQS}" result2msa "${QUERYDB}" "${SEQDB}" \
                "${INPUT}" "${MSA}" \
                -v 0 --threads "${JOBTHREADS}" \
                ${PARAMS_RESULT2MSA} ${SKIPQUERY} \
            || fail "result2msa failed"
        MSAS="${MSAS} ${MSA}"

        local ALI="${WORKDIR}/alis_${DB}"
        "${MMSEQS}" convertalis "${QUERYDB}" "${SEQDB}" \
                "${WORKDIR}/result_${DB}" "${ALI}" \
                --no-preload --early-exit --db-output -v 0 \
                --threads "${JOBTHREADS}" ${PARAMS_CONVERTALIS} \
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

    if [[ ! -z "${EMAIL}" ]]; then
        send_email "${EMAIL}" "MMseqs Job done: ${JOBID}" "${JOBID}"
    fi
}

run_job "$1" "$2" "$3" "$4" "$5"
