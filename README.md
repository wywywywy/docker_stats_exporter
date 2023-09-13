# Docker Stats exporter for Prometheus

This exporter uses [Apocas's Dockerode library](https://github.com/apocas/dockerode).

This exporter was created because the official Docker exporter only exports engine metrics not containers', and the alternative Google's cAdvisor uses quite a lot of resources to run.

The output essentially mirrors the CLI output of `docker stats`.

## Usage

### Arguments

    --port     9487         Exporter listens on this port (default = 9487)
    --interval 15           Polling interval in seconds (default = 15, minimum 3)
    --hostip   127.0.0.1    Docker engine IP to connect to (if using HTTP)
    --hostport 2375         Docker engine port to connect to (if using HTTP)
    --collectdefault        Collect default Prometheus metrics as well (default = false)
    --containers2collect '' Collect stats ONLY for containers matching filter on 'name'. Ref. https://docs.docker.com/config/filter/
                            Example: "(cname1|.*other_cnames)"

If no `hostip` and `hostport` provided, it defaults to connect via socket to `/var/run/docker.sock`.

### Environment Variables

The arguments can also be set as env variables instead. Useful if you're using it in a Docker container.

1. DOCKERSTATS_PORT
1. DOCKERSTATS_INTERVAL
1. DOCKERSTATS_HOSTIP
1. DOCKERSTATS_HOSTPORT
1. DOCKERSTATS_DEFAULTMETRICS
1. DOCKERSTATS_CONTAINERS2COLLECT

## Installation

### From Source

Node.js 14 is required to run it.

    git clone git@github.com:wywywywy/docker_stats_exporter.git
    cd docker_stats_exporter
    npm ci
    npm start

### With Docker

    docker run -d --restart=always -p 9487:9487 -v /var/run/docker.sock:/var/run/docker.sock wywywywy/docker_stats_exporter:latest

### Prometheus Config

Add this to `prometheus.yml` and change the IP/port if needed.

    - job_name: 'docker_stats_exporter'
        metrics_path: /
        static_configs:
        - targets:
            - '127.0.0.1:9487'

## Notes on Metrics

If you don't see any memory metrics, try to run `docker stats` to see if the memory usage ever goes above zero. If not, that means **cgroup memory support** is not enabled in the kernel, which is most likely the reason if you're using Raspberry Pi OS.

See this issue for instructions to have it enabled: https://github.com/moby/moby/issues/18420

## Notes on Performance

Because of the way `docker stats` works, it always takes at least 2 seconds to output the results.  Basically it takes a snapshot, then after a second it takes another snapshot to compare the results.

So there is no point pooling the Docker engine more than once every 3 or so seconds.

Also because `docker stats` runs one process for each container to gather metrics, this exporter is not suitable for hosts that have a large number (hundreds) of containers.

## TODO

1. ~~Block IO metrics~~
2. Other useful metrics not in `docker stats`
3. Add some sane default max limit on number of containers to collect stats (if on a node with huge number of containers)

## Contributing

Yes, contributions are always welcome.  
Fork it, clone it, submit a pull request, etc.

### Docker build example...
will tag with version info from 'package.json'
docker login ...
docker build -t <user>/docker_stats_exporter:latest -t <user>/docker_stats_exporter:$(npm pkg get version --workspaces=false | tr -d \") .
docker push ...

## License

This is licensed under the Apache License 2.0.
