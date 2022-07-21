#!/bin/sh -ex
DB=${1}

if [ "${DB}" = "" ]; then
    "${APP}" databases;
    exit 0;
fi

SAFE=$(echo "${DB}" | tr -cd '[a-zA-Z0-9]._-')
if [ ! -e "/opt/mmseqs-web/databases/${SAFE}.dbtype" ]; then
    "${APP}" databases "${DB}" "/opt/mmseqs-web/databases/${SAFE}" /tmp
fi

if [ ! -e "/opt/mmseqs-web/databases/${SAFE}.idx.dbtype" ]; then
    "${APP}" createindex "/opt/mmseqs-web/databases/${SAFE}" /tmp --split 1
fi

VERSION=$(cat "/opt/mmseqs-web/databases/${SAFE}.version" | head -n1 | awk '{ print $1; }')
TAXONOMY=$("${APP}" databases --tsv | awk -v db="${DB}" '$1 == db { printf("%s", $3); f=1; exit; } END { if (f==0) printf("false"); }')

if [ "${TAXONOMY}" = "true" ]; then
    if [ -e "/opt/mmseqs-web/databases/${SAFE}_mapping" ]; then
        TAXHEADER=$(od -An -N 4 -w6 -t x1 "/opt/mmseqs-web/databases/${SAFE}_mapping" | tr -d ' ')
        # magic header TAXM in hex
        if [ "${TAXHEADER}" != "1300170c" ]; then
            "${APP}" createbintaxmapping "/opt/mmseqs-web/databases/${SAFE}_mapping" "/opt/mmseqs-web/databases/${SAFE}_mapping.bin"
            mv -f "/opt/mmseqs-web/databases/${SAFE}_mapping.bin" "/opt/mmseqs-web/databases/${SAFE}_mapping"
        fi
    fi
fi

echo "{\n  \"status\": \"COMPLETE\",\n  \"name\": \"${DB}\",\n  \"version\": \"${VERSION}\",\n  \"path\": \"${SAFE}\",\n  \"taxonomy\": ${TAXONOMY},\n  \"default\": true,\n  \"order\": 0,\n  \"index\": \"\",\n  \"search\": \"\"\n}" > "/opt/mmseqs-web/databases/${SAFE}.params"

