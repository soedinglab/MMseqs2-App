#!/bin/bash

docker run -u="$(id -u $(whoami)):$(id -g $(whoami))" -i -v $(readlink -f ../backend/):/var/www/mmseqs-web phpdockerio/php7-cli:latest bash -c "cd /var/www/mmseqs-web && composer install"
