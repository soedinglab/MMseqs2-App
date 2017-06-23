FROM soedinglab/mmseqs2 as mmseqs

FROM golang:alpine as mmseqs-web-builder
RUN apk add --no-cache git gcc g++ musl-dev

RUN go get -u github.com/kardianos/govendor
WORKDIR /go/src/github.com/milot-mirdita/mmseqs-web-backend
ADD vendor/vendor.json vendor/vendor.json
RUN govendor sync

ADD . .
RUN mkdir -p /opt/mmseqs-web
RUN go build -o /opt/mmseqs-web/mmseqs-web

FROM alpine:latest
MAINTAINER Milot Mirdita <milot@mirdita.de>
RUN apk add --no-cache gawk bash pigz jq tar grep libstdc++ libgomp

COPY --from=mmseqs /usr/local/bin/mmseqs_sse42 /usr/local/bin/mmseqs_sse42
COPY --from=mmseqs /usr/local/bin/mmseqs_avx2 /usr/local/bin/mmseqs_avx2
COPY --from=mmseqs /usr/local/bin/mmseqs /usr/local/bin/mmseqs

COPY --from=mmseqs-web-builder /opt/mmseqs-web/mmseqs-web /usr/local/bin/mmseqs-web
ADD build/run_job.sh /usr/local/bin/run_job.sh
