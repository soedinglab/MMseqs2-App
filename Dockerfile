FROM alpine:latest as hh-builder

RUN apk add --no-cache gcc g++ cmake musl-dev vim git ninja

WORKDIR /opt/hh-suite
RUN git clone https://github.com/soedinglab/hh-suite.git .
RUN git submodule init && git submodule update
WORKDIR build
RUN cmake -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=. ..
RUN ninja && ninja install

FROM alpine:latest as mmseqs-builder

RUN apk add --no-cache gcc g++ cmake musl-dev vim git ninja

WORKDIR /opt/mmseqs
RUN git clone https://github.com/soedinglab/mmseqs2.git .

WORKDIR build_sse
RUN cmake -G Ninja -DHAVE_SSE4_1=1 -DHAVE_MPI=0 -DHAVE_TESTS=0 -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=. ..
RUN ninja && ninja install

WORKDIR ../build_avx
RUN cmake -G Ninja -DHAVE_AVX2=1 -DHAVE_MPI=0 -DHAVE_TESTS=0 -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=. ..
RUN ninja && ninja install

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

ENV HHLIB /usr/local
COPY --from=hh-builder /opt/hh-suite/build/bin/* /usr/local/bin/
COPY --from=hh-builder /opt/hh-suite/build/data/* /usr/local/data/

COPY --from=mmseqs-builder /opt/mmseqs/build_sse/bin/mmseqs /usr/local/bin/mmseqs_sse42
COPY --from=mmseqs-builder /opt/mmseqs/build_avx/bin/mmseqs /usr/local/bin/mmseqs_avx2
ADD mmseqs_wrapper.sh /usr/local/bin/mmseqs

COPY --from=mmseqs-web-builder /opt/mmseqs-web/mmseqs-web /usr/local/bin/mmseqs-web
ADD build/run_job.sh /usr/local/bin/run_job.sh