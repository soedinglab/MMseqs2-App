FROM node:latest as mmseqs-web-frontend-builder

RUN apt-get install bzip2 fontconfig tar

WORKDIR /opt/mmseqs-frontend
ADD package.json .
RUN npm install

ADD . .
RUN npm run build

FROM tianon/true
MAINTAINER Milot Mirdita <milot@mirdita.de> 
VOLUME ["/var/www/mmseqs-web"]
COPY --from=mmseqs-web-frontend-builder /opt/mmseqs-frontend/dist /var/www/mmseqs-web