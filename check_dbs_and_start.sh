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

    local PROFILE=0
    if [[ -s "${BASE}.fasta" ]]; then
        echo "Building search database from ${BASE}.fasta ..."

        mmseqs createdb "${BASE}.fasta" "${BASE}"

        echo "Finding longest entry ..."
        PARAMS_MAXSEQLEN="$(awk '$3 > max { max = $3 } END { print max+1 }' "${BASE}.index")"

        mmseqs createindex "${BASE}" --mask 2 --include-headers --max-seq-len "${PARAMS_MAXSEQLEN}"

        echo "Moving input fasta file to ${BASE}.fasta.bak ..."
        mv "${BASE}.fasta" "${BASE}.fasta.bak"
    elif [[ -s "${BASE}_msa" ]] && [[ -s "${BASE}_msa.index" ]]; then

        local SENSE=4
        if [[ -n "${PARAMS_SEARCH}" ]]; then
            SENSE="$(parse_sense ${PARAMS_SEARCH})"
        fi

        mmseqs msa2profile "${BASE}_msa" "${BASE}"

        echo "Finding longest entry ..."
        PARAMS_MAXSEQLEN="$(awk '$3 > max { max = $3 } END { print max+1 }' "${BASE}_seq.index")"

        mmseqs createindex "${BASE}" -s "${SENSE}" --mask 2 --include-headers --target-profile --max-seq-len "${PARAMS_MAXSEQLEN}"

        PROFILE=1

        echo "Moving input database to ${BASE}_msa.bak ..."
        mv "${BASE}_msa" "${BASE}_msa.bak"
        mv "${BASE}_msa.index" "${BASE}_msa.index.bak"
    fi

    if [[ -z "${PARAMS_MAXSEQLEN}" ]]; then
        jq --arg maxSeqLen "${PARAMS_MAXSEQLEN}" --arg profile "${PROFILE}"  \
            '. * {params : { profile: $profile, maxseqlen: [ 32000, $maxSeqLen] | max }}' "${BASE}.params"  \
            > "${BASE}.params.tmp"
        mv -f "${BASE}.params.tmp" "${BASE}.params"
    fi
}
export -f check_params

#find /big/search.mmseqs.com/databases -maxdepth 1 -type f -name '*.params' -exec bash -ex -c 'check_params "$0"' "{}" ';'
find /opt/mmseqs-web/databases/ -maxdepth 1 -type f -name '*.params' -exec bash -ex -c 'check_params "$0"' "{}" ';'

echo "Done. Starting Webserver..."
exec /usr/local/bin/mmseqs-web
