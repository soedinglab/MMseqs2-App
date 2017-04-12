#!/bin/bash -e
export BASE="/big/search.mmseqs.org"
export WORKBASE="${BASE}/jobs"
export DATABASES="${BASE}/databases"
export MMSEQS="${BASE}/mmseqs/bin/mmseqs"
export REDISCLI="redis-cli"
export SEARCH_PIPELINE="${BASE}/pipeline/run_job.sh"
export SEARCH_DATABASES_ARRAY="uniclust30_2017_02 uniclust90_2017_02 eggnog_4.5 pdb70_17Mar17 pfam_30.0"
export SEARCH_DATABASES_TYPES_ARRAY="sequence sequence domain domain domain"
