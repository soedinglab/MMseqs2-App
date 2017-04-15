#!/bin/bash
(
    function getenv() {
        env | awk -F'=' '/^\w/ { print $1 }' | grep -v '^PATH$' | grep -v '^LC_' | grep -v '^_$' | tr '\n' ' '
    }
    unset $(getenv)
    BASE="$(cd $(dirname ${BASH_SOURCE}) && pwd)"
    source "${BASE}/paths.sh"
    JSON="{\n"
    NAMES=()
    CNT=0
    for i in $(getenv); do 
        JSON+="\t"
        if (( $CNT > 0 )); then
            JSON+=", "
        fi
        NAME=$(echo ${i} | tr '[:upper:]' '[:lower:]' | tr '_' '-')
        if [[ $i =~ _ARRAY$ ]]; then
            NAME=${NAME%-array}
            JSON+="\"${NAME}\": [\n"
            INNERCNT=0
            for j in ${!i}; do
                JSON+="\t\t"
                if (( $INNERCNT > 0 )); then
                    JSON+=", "
                fi
                JSON+="\"${j}\"\n"
                INNERCNT=$((INNERCNT + 1))
            done
            JSON+="\t]\n"
        else
            JSON+="\"${NAME}\": \"${!i}\"\n"
        fi
        NAMES+=($NAME)
        CNT=$((CNT + 1))
    done
    JSON+="}\n"

    UNIQUE=$(printf '%s\n' "${NAMES[@]}" | sort -u | wc -l)
    if (( $UNIQUE != ${#NAMES[@]} )); then
        echo "Duplicate key found, please fix the config file!"
        exit 1
    fi

    echo -e "${JSON}" | tee "${BASE}/backend/config-cache.json" | jq -r --argjson keys '["search-databases", "search-databases-types"]' 'with_entries(select(.key as $k | $keys | index($k)))' > "${BASE}/frontend/src/config-cache.json"
)
