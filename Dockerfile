FROM node:12-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

RUN npm i -g npm@6

COPY package*.json /usr/src/app/
RUN npm ci

COPY docker_stats_exporter.js /usr/src/app/

EXPOSE 9487
ENV DOCKERSTATS_PORT=9487 DOCKERSTATS_INTERVAL=15 DEBUG=0

ENTRYPOINT [ "npm", "start" ]