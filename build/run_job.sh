#!/bin/bash -exu
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
    # leaf paths and explode ... implode for 1.4 compatibility
    jq -r 'leaf_paths as $p | ($p | join("_") | explode | map( if 97 <= . and . <= 122 then . - 32  else . end) | implode) as $k | getpath($p) | tostring as $v | "export " + $k + "=" + "\"" + $v + "\""'
}

function run_job() {
    local MMSEQS="$1"
    local WORKBASE="$2"
    local JOBID="$3"
    local WORKDIR="${WORKBASE}/${JOBID}"
    local VERBOSITY="3"
    local JOBTHREADS="16"

    mkdir -p "${WORKDIR}"

    local MMTMP="${WORKDIR}/tmp"
    mkdir -p "${MMTMP}"

	local QUERYFASTA="${WORKDIR}/job.fasta"
	local QUERYDB="${WORKDIR}/input"

    local DATABASES="$4"
    local TARGETS="$5"

    local MODE="$6"
    case "${MODE}" in
        accept)
            ;;
        summary)
            ;;
        *)
            fail "Invalid mode!"
            ;;
    esac

    "${MMSEQS}" createdb "${QUERYFASTA}" "${QUERYDB}" -v "${VERBOSITY}" \
        || fail "createdb failed"

    local ALIS=""
    local M8S=""
    for DB in ${TARGETS}; do
        mkdir -p "${MMTMP}/${DB}"

        local PARAMS_SEARCH=""
        local PARAMS_SUMMARIZERESULT=""
        local PARAMS_CONVERTALIS=""
        local PARAMS_MAXSEQLEN="32000"

        if [[ -f "${DATABASES}/${DB}.params" ]]; then
            eval "$(cat ${DATABASES}/${DB}.params | json2export)";
        fi

        INPUT="${WORKDIR}/result_${DB}"
        "${MMSEQS}" search "${QUERYDB}" "${DATABASES}/${DB}" \
                "${INPUT}" "${MMTMP}/${DB}" \
                --no-preload --early-exit --remove-tmp-files \
                --max-seq-len "${PARAMS_MAXSEQLEN}" \
                --split-mode 1 -v "${VERBOSITY}" --threads "${JOBTHREADS}" \
                ${PARAMS_SEARCH} \
            || fail "search failed"
        
        local SEQDB="${DATABASES}/${DB}"
        if [[ -f "${DATABASES}/${DB}_seq" ]]; then
            SEQDB="${DATABASES}/${DB}_seq"
        fi

        if [[ "${MODE}" == "summary" ]]; then
            "${MMSEQS}" summarizeresult "${INPUT}" "${WORKDIR}/summarized_${DB}" \
                    -a -v "${VERBOSITY}" --threads "${JOBTHREADS}" \
                    ${PARAMS_SUMMARIZERESULT} \
                || fail "summarizeresult failed"
            INPUT="${WORKDIR}/summarized_${DB}"
        fi

        local ALI="${WORKDIR}/alis_${DB}"
        "${MMSEQS}" convertalis "${QUERYDB}" "${SEQDB}" \
                "${INPUT}" "${ALI}" \
                --no-preload --early-exit --db-output -v "${VERBOSITY}" \
                --threads "${JOBTHREADS}" ${PARAMS_CONVERTALIS} \
            || fail "convertalis failed"

        ALIS="${ALIS} ${ALI}"

        local M8="${WORKDIR}/${JOBID}_${DB}.m8"
        tr -d '\000' < "${ALI}" > "${M8}"
        M8S="${M8S} ${M8}"     

        rm -f "${WORKDIR}/result_${DB}" "${WORKDIR}/result_${DB}.index"
    done

    tar -cv --use-compress-program=pigz \
        --show-transformed-names --transform "s|${WORKDIR:1}/|mmseqs_results_${JOBID}/|g" \
        -f "${WORKDIR}/mmseqs_results_${JOBID}.tar.gz" ${M8S}

    rm -f ${M8S}
}

run_job "$1" "$2" "$3" "$4" "$5" "$6"
