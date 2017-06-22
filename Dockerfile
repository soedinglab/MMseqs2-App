FROM node:latest as mmseqs-web-frontend-builder

RUN apt-get update && apt-get install -y build-essential chrpath libssl-dev libxft-dev bzip2 fontconfig tar libfreetype6 libfreetype6-dev libfontconfig libfontconfig-dev

WORKDIR /opt/mmseqs-frontend
ADD package.json .
RUN npm install

ADD . .
RUN npm run build

FROM tianon/true
MAINTAINER Milot Mirdita <milot@mirdita.de> 
VOLUME ["/var/www/mmseqs-web"]
COPY --from=mmseqs-web-frontend-builder /opt/mmseqs-frontend/dist /var/www/mmseqs-web
