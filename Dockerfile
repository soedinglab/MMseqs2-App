FROM node:latest as mmseqs-web-frontend-builder

RUN echo 'deb http://deb.debian.org/debian jessie-backports main' > /etc/apt/sources.list.d/backports.list
RUN apt-get update && apt-get install -y build-essential bzip2 fontconfig tar phantomjs

WORKDIR /opt/mmseqs-frontend
ADD package.json .
RUN npm install

ADD . .
RUN npm run build

FROM tianon/true
MAINTAINER Milot Mirdita <milot@mirdita.de> 
VOLUME ["/var/www/mmseqs-web"]
COPY --from=mmseqs-web-frontend-builder /opt/mmseqs-frontend/dist /var/www/mmseqs-web
