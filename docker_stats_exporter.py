#!/usr/bin/python
# -*- coding: UTF-8 -*-

#import core modules
import os
import sys
import time
import json
import argparse

# import the prometheus modules
import prometheus_client
from prometheus_client import start_http_server, Metric, REGISTRY, Gauge
from prometheus_client.core import GaugeMetricFamily

# import the docker modules
import docker

DEBUG = int(os.environ.get('DEBUG', '0'))


class DataCollector(object):
    def __init__(self):
        self._app = 'dockerstats'

    def collect(self):
        # init
        app = 'dockerstats'
        client = docker.from_env()

        # work each container
        for container in client.containers.list():
            if container.status == 'running':
                stats = container.stats(decode=False,stream=False)
                containerName = stats['name'].replace('/','',1)
                containerId = stats['id'][:12]
                metricId = '{name="' + containerName + '",id="' + containerId + '"}'

                # cpu
                cpuDelta = stats['cpu_stats']['cpu_usage']['total_usage'] - stats['precpu_stats']['cpu_usage']['total_usage']
                systemDelta = stats['cpu_stats']['system_cpu_usage'] - stats['precpu_stats']['system_cpu_usage']
                if systemDelta <= 0:
                    systemDelta = 1
                cpuPercent = round(((cpuDelta / systemDelta) * stats['cpu_stats']['online_cpus'] * 100), 2)
                cpuPercentMetric = app + '_cpu_usage_ratio' + metricId
                yield GaugeMetricFamily(cpuPercentMetric, 'CPU usage percentage 0-100', cpuPercent)

                # memory
                memUsage = stats['memory_stats']['usage']
                memUsageMetric = app + '_memory_usage_bytes' + metricId
                yield GaugeMetricFamily(memUsageMetric, 'Memory usage in bytes', memUsage)
                memLimit = stats['memory_stats']['limit']
                if memLimit <= 0:
                    memLimit = 1
                memLimitMetric = app + '_memory_limit_bytes' + metricId
                yield GaugeMetricFamily(memLimitMetric, 'Memory limit in bytes', memLimit)
                memPercent = round(((memUsage / memLimit) * 100), 2)
                memPercentMetric = app + '_memory_usage_ratio' + metricId
                yield GaugeMetricFamily(memPercentMetric, 'Memory usage percentage 0-100', memPercent)

                # network
                netRx = stats['networks']['eth0']['rx_bytes']
                netRxMetric = app + '_network_received_bytes' + metricId
                yield GaugeMetricFamily(netRxMetric, 'Network received in bytes', netRx)
                netTx = stats['networks']['eth0']['tx_bytes']
                netTxMetric = app + '_network_transmitted_bytes' + metricId
                yield GaugeMetricFamily(netTxMetric, 'Network transmitted in bytes', netTx)
                

def parse_args():
    parser = argparse.ArgumentParser(
        description='Docker Stats exporter for Prometheus available arguments:'
    )
    parser.add_argument(
        '--port',
        metavar='9487',
        required=False,
        type=int,
        help='Exporter listens on this port',
        default=int(os.environ.get('DOCKERSTATS_PORT', '9487'))
    )
    return parser.parse_args()


if __name__ == "__main__":
    try:
        # get & check args
        args = parse_args()
        port = int(args.port)

        # register & start prometheus exporter server
        REGISTRY.register(DataCollector())
        start_http_server(port)
        print("Docker Stats exporter for Prometheus. Serving on port: {}".format(port))
        while True: time.sleep(1)
    except KeyboardInterrupt:
        print('Keyboard interrupted. Exiting')
        exit(0)