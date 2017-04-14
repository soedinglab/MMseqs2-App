FROM nginx:stable

ADD https://deb.nodesource.com/setup_6.x setup.sh

RUN chmod +x setup.sh && sync && ./setup.sh && rm setup.sh \
    && apt-get -y install nodejs build-essential git \
    && apt-get clean; rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /usr/share/doc/*

ADD nginx.conf /etc/nginx/conf.d/default.conf
ADD . /var/www/mmseqs-web
RUN cd /var/www/mmseqs-web && npm install && npm run build && rm -rf /var/www/mmseqs-web/node_modules

RUN apt-get -y remove nodejs build-essential git \
    && apt-get clean; rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /usr/share/doc/*

WORKDIR "/var/www/mmseqs-web"
