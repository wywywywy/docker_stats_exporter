# **WORK IN PROGRESS NOT READY FOR USE**

Docker Stats exporter for Prometheus.io, written in Node.js 8.

This exporter uses [Apocas's Dockerode library](https://github.com/apocas/dockerode).

This exporter was created because the official Docker exporter only exports engine metrics not containers', and the alternative Google's cAdvisor uses quite a lot of resources to run.

The output basically mirrors the CLI output of `docker stats`.

# Usage

## Arguments

    --port     9487         Exporter listens on this port (default = 9487)
    --hostip   127.0.0.1    Docker engine IP to connect to (when using HTTP)
    --hostport 2375         Docker engine port to connect to (when using HTTP)
    --collectdefault        Collect default Prometheus metrics as well (default = false)

If no `hostip` and `hostport` provided, it defaults to connect via socket to `/var/run/docker.sock`.

## Environment Variables

The arguments can also be set as env variables instead. Useful if you're using it in a Docker container.
1. DOCKERSTATS_PORT
2. DOCKERSTATS_HOSTIP
3. DOCKERSTATS_HOSTPORT
4. DOCKERSTATS_DEFAULTMETRICS

# Installation

## From Source

Node 8 is required to run it.

    git clone git@github.com:wywywywy/docker_stats_exporter.git
    cd docker_stats_exporter
    npm install
    npm start

Recommend npm version >= 6, as version 5 seems to have problems installing Dockerode.

## With Docker

    docker run -d --restart=always -p 9487:9487 -v /var/run/docker.sock:/var/run/docker.sock -v /usr/bin/docker:/usr/bin/docker wywywywy/docker_stats_exporter:latest

## Prometheus Config

Add this to prometheus.yml and change the IP/port if needed.

    - job_name: 'docker_stats_exporter'
        metrics_path: /
        static_configs:
        - targets:
            - '127.0.0.1:9487'

# Notes on Performance

Because of the way `docker stats` works, it always takes at least 2 seconds to output the results.  Basically it takes a snapshot then after a second it takes another one to compare the results.

So there is no point querying the exporter more than once every 3 or so seconds.

Also because `docker stats` runs one process for each container to gather metrics, this exporter is not suitable for nodes that have a large number (hundreds) of containers.

# TODO

1. Block IO metrics
2. Other useful metrics not in `docker stats`

# Contributing

Yes, contributions are always welcome.  
Fork it, clone it, submit a pull request, etc.

# License

This is licensed under the Apache License 2.0.
