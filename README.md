# **WORK IN PROGRESS NOT READY FOR USE**

Docker Stats exporter for Prometheus.io, written in Python 3.

This exporter uses [Docker's Docker-py library](https://github.com/docker/docker-py).

This exporter was created because the official Docker exporter only exports engine metrics not containers', and the alternative Google's cAdvisor uses quite a lot of resources to run.

The output basically mirrors the CLI output of `docker stats`.

# Usage

## Arguments

    --port 9487           Exporter listens on this port

## Environment Variables

The arguments can also be set as env variables instead. Useful if you're using it in a Docker container.
1. DOCKERSTATS_PORT

# Installation

## From Source

    git clone git@github.com:wywywywy/docker_stats_exporter.git
    cd docker_stats_exporter
    pip install -r requirements.txt

Use pip3 if your pip is for Python 2.

## With Docker

    docker run -d --restart=always -p 9487:9487 -v /var/run/docker.sock:/var/run/docker.sock -v /usr/bin/docker:/usr/bin/docker wywywywy/docker_stats_exporter:latest

## Prometheus Config

Add this to prometheus.yml and change the IP/port if needed.

    - job_name: 'docker_stats_exporter'
        metrics_path: /
        static_configs:
        - targets:
            - '127.0.0.1:9487'

# TODO

1. Block IO metrics
2. Other useful metrics not in `docker stats`

# Contributing

Yes, contributions are always welcome.  
Fork it & submit a pull request.

# License

This is licensed under the Apache License 2.0.
