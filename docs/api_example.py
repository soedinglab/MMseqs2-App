#!/usr/bin/env python3
from requests import get, post
from time import sleep

# submit a new job
ticket = post('https://search.mmseqs.com/api/ticket', {
            'q' : '>FASTA\nMPKIIEAIYENGVFKPLQKVDLKEGE\n',
            'database[]' : ["uniclust30_2017_10_seed"],
            'mode' : 'all',
        }).json()

# poll until the job was successful or failed
repeat = True
while repeat:
    status = get('https://search.mmseqs.com/api/ticket/' + ticket['id']).json()
    if status['status'] == "ERROR":
        # handle error
        sys.exit(0)

    # wait a short time between poll requests
    sleep(1)
    repeat = status['status'] != "COMPLETE"

# get all hits for the first query (0)
result = get('https://search.mmseqs.com/api/result/' + ticket['id'] + '/0').json()
# print pairwise alignment of first hit of first database
print(result['results'][0]['alignments'][0]['qAln'])
print(result['results'][0]['alignments'][0]['dbAln'])

# download blast compatible result archive
download = get('https://search.mmseqs.com/api/result/download/' + ticket['id'], stream=True)
with open('result.tar.gz', 'wb') as fd:
    for chunk in download.iter_content(chunk_size=128):
        fd.write(chunk)

