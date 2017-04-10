#!/bin/bash -e
export BASE="/big/search.mmseqs.org"
export WORKBASE="${BASE}/jobs"
export DATABASES="${BASE}/databases"
export MMSEQS="${BASE}/mmseqs/bin/mmseqs"
export REDISCLI="redis-cli"
export SEARCH_PIPELINE="${BASE}/pipeline/run_job.sh"
export SEARCH_DATABASES_ARRAY="uc30 uc90"
export ANNOTATION_DATABASES_ARRAY="pfam eggnog pdb70"
