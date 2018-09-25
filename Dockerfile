FROM python:3.6-slim

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

COPY requirements.txt /usr/src/app
RUN pip install --no-cache-dir -r requirements.txt

COPY docker_stats_exporter.py /usr/src/app

EXPOSE 9488
ENV DOCKERSTATS_PORT=9487 DEBUG=0

ENTRYPOINT [ "python", "-u", "./docker_stats_exporter.py" ]