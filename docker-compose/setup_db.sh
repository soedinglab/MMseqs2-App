#!/bin/sh -e
if [ "$#" = "0" ]; then
    "${APP}" databases;
    exit 0;
fi

DBPATH="${DBPATH:-"/opt/mmseqs-web/databases"}"

for DB in "${@}"; do

SAFE=$(echo "${DB}" | tr -cd '[a-zA-Z0-9]._-')
if [ ! -e "$DBPATH/${SAFE}.dbtype" ]; then
    "${APP}" databases "${DB}" "$DBPATH/${SAFE}" "$DBPATH/tmp_${SAFE}" || continue
fi

if [ ! -e "$DBPATH/${SAFE}.idx.dbtype" ]; then
    "${APP}" createindex "$DBPATH/${SAFE}" "$DBPATH/tmp_${SAFE}" --split 1
fi

rm -rf -- "$DBPATH/tmp_${SAFE}"

VERSION=$(cat "$DBPATH/${SAFE}.version" | head -n1 | awk '{ print $1; }')
TAXONOMY=$("${APP}" databases --tsv | awk -v db="${DB}" '$1 == db { printf("%s", $3); f=1; exit; } END { if (f==0) printf("false"); }')

if [ "${TAXONOMY}" = "true" ]; then
    if [ -e "$DBPATH/${SAFE}_mapping" ]; then
        TAXHEADER=$(od -An -N 4 -w6 -t x1 "$DBPATH/${SAFE}_mapping" | tr -d ' ')
        # magic header TAXM in hex
        if [ "${TAXHEADER}" != "1300170c" ]; then
            "${APP}" createbintaxmapping "$DBPATH/${SAFE}_mapping" "$DBPATH/${SAFE}_mapping.bin"
            mv -f "$DBPATH/${SAFE}_mapping.bin" "$DBPATH/${SAFE}_mapping"
        fi
    fi
fi

echo "{\n  \"status\": \"COMPLETE\",\n  \"name\": \"${DB}\",\n  \"version\": \"${VERSION}\",\n  \"path\": \"${SAFE}\",\n  \"taxonomy\": ${TAXONOMY},\n  \"default\": true,\n  \"order\": 0,\n  \"index\": \"\",\n  \"search\": \"\"\n}" > "$DBPATH/${SAFE}.params"

done
