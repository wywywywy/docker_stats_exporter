FROM node:8-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN npm i -g npm

COPY package*.json /usr/src/app/
RUN npm ci

COPY docker_stats_exporter.js /usr/src/app/

EXPOSE 9487
ENV DOCKERSTATS_PORT=9487 DEBUG=0

ENTRYPOINT [ "npm", "start" ]