#!/bin/bash -e

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
export -f abspath

function make_database_from_fasta() {
    local INPUT="$(abspath $1)"
    local OUTPUT="$(abspath $2)"
    local MAXSENS="$3"

    1>&2 mmseqs createdb "${INPUT}" "${OUTPUT}"
    1>&2 mmseqs createindex "${OUTPUT}" --mask 2 --include-headers --max-seq-len "${MAXSENS}"
}
export -f make_database_from_fasta

function make_database_from_db() {
    local INPUT="$(abspath $1)"
    local OUTPUT="$(abspath $2)"
    local MAXSENS="$3"

    1>&2 mmseqs msa2profile "${INPUT}" "${OUTPUT}"

    1>&2 echo "Finding longest entry ..."
    local MAXSEQLEN="$(awk '$3 > max { max = $3 } END { print max+1 }' "${BASE}_seq.index")"
    1>&2 mmseqs createindex "${OUTPUT}" -s "${MAXSENS}" --mask 2 --include-headers --target-profile --max-seq-len "${MAXSEQLEN}"

    echo "${MAXSEQLEN}"
}
export -f make_database_from_db

function parse_sense() {
    local SENS=4

    while getopts "s:" opt; do
        case $opt in
            s)
                SENS="$OPTARG"
                ;;
        esac
    done

    echo "$SENS"
}
export -f parse_sense

function json2export() {
    # leaf paths and explode ... implode for 1.4 compatibility
    jq -r 'leaf_paths as $p | ($p | join("_") | explode | map( if 97 <= . and . <= 122 then . - 32  else . end) | implode) as $k | getpath($p) | tostring as $v | "export " + $k + "=" + "\"" + $v + "\""'
}
export -f json2export

function check_params() {
    local PARAMS="$1"
    local BASE="$(dirname "${PARAMS}")/$(basename "${PARAMS}" .params)"

    echo "Checking ${PARAMS}..."
    eval "$(cat "$PARAMS" | json2export)";

    if [[ -s "${BASE}.fasta" ]]; then
        echo "Building search database from ${BASE}.fasta ..."

        echo "Finding longest entry ..."
        PARAMS_MAXSEQLEN="$(awk '$3 > max { max = $3 } END { print max+1 }' "${BASE}.index")"

        make_database_from_fasta "${BASE}.fasta" "${BASE}" "${PARAMS_MAXSEQLEN}"

        echo "Moving input fasta file to ${BASE}.fasta.bak ..."
        mv "${BASE}.fasta" "${BASE}.fasta.bak"
    elif [[ -s "${BASE}_msa" ]] && [[ -s "${BASE}_msa.index" ]]; then

        local SENSE=4
        if [[ -n "${PARAMS_SEARCH}" ]]; then
            SENSE="$(parse_sense ${PARAMS_SEARCH})"
        fi

        echo "Building profile search database from ${BASE}_msa with SENS=${SENSE} ..."
        PARAMS_MAXSEQLEN=$(make_database_from_db "${BASE}_msa" "${BASE}" "${SENSE}")

        jq  '. * {params : { profile: 1 }}'  "${BASE}.params" > "${BASE}.params.tmp"
        mv -f "${BASE}.params.tmp" "${BASE}.params"

        echo "Moving input database to ${BASE}_msa.bak ..."
        mv "${BASE}_msa" "${BASE}_msa.bak"
        mv "${BASE}_msa.index" "${BASE}_msa.index.bak"
    fi

    if [[ -z "${PARAMS_MAXSEQLEN}" ]]; then
        jq --arg maxSeqLen "${PARAMS_MAXSEQLEN}"  \
            '. * {params : { maxseqlen: [ 32000, $maxSeqLen] | max }}'  "${BASE}.params"  \
            > "${BASE}.params.tmp"
        mv -f "${BASE}.params.tmp" "${BASE}.params"
    fi
}
export -f check_params

#find /big/search.mmseqs.com/databases -maxdepth 1 -type f -name '*.params' -exec bash -ex -c 'check_params "$0"' "{}" ';'
find /opt/mmseqs-web/databases/ -maxdepth 1 -type f -name '*.params' -exec bash -ex -c 'check_params "$0"' "{}" ';'

echo "Done. Starting Webserver..."
exec /usr/local/bin/mmseqs-web
