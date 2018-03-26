FROM node:latest as mmseqs-web-frontend-builder

RUN apt-get update && apt-get install -y build-essential bzip2 fontconfig tar

WORKDIR /opt/mmseqs-frontend
ADD package.json .
RUN npm install

ADD . .
RUN npm run build

FROM tianon/true
LABEL maintainer="Milot Mirdita <milot@mirdita.de>"
COPY --from=mmseqs-web-frontend-builder /opt/mmseqs-frontend/dist /var/www/mmseqs-web
