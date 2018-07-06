FROM alpine:3.7 as hh-builder
RUN apk add --no-cache gcc g++ cmake musl-dev git ninja

WORKDIR /opt/hh-suite
RUN git clone https://github.com/soedinglab/hh-suite.git .
RUN git submodule init && git submodule update
WORKDIR build
RUN cmake -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=. ..
RUN ninja hhconsensus

FROM alpine:3.7 as ffindex-builder
RUN echo "@testing http://nl.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories
RUN apk add --no-cache gcc cmake musl-dev ninja git openmpi@testing openmpi-dev@testing

WORKDIR /opt/ffindex
RUN git clone https://github.com/soedinglab/ffindex_soedinglab.git .

WORKDIR build
RUN cmake -G Ninja -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX=. ..
RUN ninja && ninja install

FROM alpine:3.7
MAINTAINER Milot Mirdita <milot@mirdita.de>
RUN echo "@testing http://nl.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories
RUN apk add --no-cache tar gawk bash grep curl libstdc++ libgomp openmpi@testing

ENV OMPI_MCA_plm=isolated
COPY --from=ffindex-builder /opt/ffindex/build/bin /usr/local/bin/

ENV HHLIB=/usr/local
COPY --from=hh-builder /opt/hh-suite/data/* /usr/local/data/
COPY --from=hh-builder /opt/hh-suite/build/bin/hhconsensus /usr/local/bin/

ADD eggnog/build_eggnog.sh /usr/local/bin/
ADD eggnog/apply_eggnog.sh /usr/local/bin/
