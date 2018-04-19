#!/bin/bash
hhconsensus -maxres 65535 -i stdin -s /dev/null -ofas stdout -v 0 | \
    awk -v name="${FFINDEX_ENTRY_NAME}" 'NR == 1 { next } NR == 2 { print ">"name; next } { print $0 }'
