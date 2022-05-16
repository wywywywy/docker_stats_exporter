FROM node:14-alpine

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY package*.json /usr/src/app/
RUN npm ci

COPY docker_stats_exporter.js /usr/src/app/

EXPOSE 9487
ENV DOCKERSTATS_PORT=9487 DOCKERSTATS_INTERVAL=15 DEBUG=0

ENTRYPOINT [ "npm", "start" ]