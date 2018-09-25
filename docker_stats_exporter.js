#!/usr/bin/env node
'use strict';
const http = require('http');
const prom = require('prom-client');
const Docker = require('dockerode');
const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const appName = 'dockerstats';

// Initialize prometheus metrics.
const gaugeCpuUsageRatio = new prom.Gauge({
    'name': appName + '_cpu_usage_ratio',
    'help': 'CPU usage percentage 0-100',
    'labelNames': ['name', 'id'],
});
const gaugeMemoryUsageBytes = new prom.Gauge({
    'name': appName + '_memory_usage_bytes',
    'help': 'Memory usage in bytes',
    'labelNames': ['name', 'id'],
});
const gaugeMemoryLimitBytes = new prom.Gauge({
    'name': appName + '_memory_limit_bytes',
    'help': 'Memory limit in bytes',
    'labelNames': ['name', 'id'],
});
const gaugeMemoryUsageRatio = new prom.Gauge({
    'name': appName + '_memory_usage_ratio',
    'help': 'Memory usage percentage 0-100',
    'labelNames': ['name', 'id'],
});
const gaugeNetworkReceivedBytes = new prom.Gauge({
    'name': appName + '_network_received_bytes',
    'help': 'Network received in bytes',
    'labelNames': ['name', 'id'],
});
const gaugeNetworkTransmittedBytes = new prom.Gauge({
    'name': appName + '_network_transmitted_bytes',
    'help': 'Network transmitted in bytes',
    'labelNames': ['name', 'id'],
});

// Register all metrics
const register = new prom.Registry();
register.registerMetric(gaugeCpuUsageRatio);
register.registerMetric(gaugeMemoryUsageBytes);
register.registerMetric(gaugeMemoryLimitBytes);
register.registerMetric(gaugeMemoryUsageRatio);
register.registerMetric(gaugeNetworkReceivedBytes);
register.registerMetric(gaugeNetworkTransmittedBytes);

async function gatherMetrics() {
    try {
        // Get all containers
        let containers = await docker.listContainers();
        if (!containers || !Array.isArray(containers) || !containers.length) {
            throw new Error('Unable to get containers');
        }

        // Get stats for each container in parallel
        let promises = [];
        for (let container of containers) {
            promises.push(docker.getContainer(container.Id).stats({ 'stream': false, 'decode': true }));
        }

        // Build metrics for each container
        let results = await Promise.all(promises);
        for (let result of results) {
            let containerName = result['name'].replace('/','');
            let containerId = result['id'].slice(0,12);
            let labels = {'name': containerName, 'id': containerId};

            // CPU
            let cpuDelta = result['cpu_stats']['cpu_usage']['total_usage'] - result['precpu_stats']['cpu_usage']['total_usage'];
            let systemDelta = result['cpu_stats']['system_cpu_usage'] - result['precpu_stats']['system_cpu_usage'];
            if (systemDelta <= 0) {
                systemDelta = 1;
            }
            let cpuPercent = parseFloat(((cpuDelta / systemDelta) * result['cpu_stats']['online_cpus'] * 100).toFixed(2));
            gaugeCpuUsageRatio.set(labels, cpuPercent);

            // Memory
            let memUsage = result['memory_stats']['usage'];
            let memLimit = result['memory_stats']['limit'];
            if (memLimit <= 0) {
                memLimit = 1;
            }
            let memPercent = parseFloat(((memUsage / memLimit) * 100).toFixed(2));
            gaugeMemoryUsageBytes.set(labels, memUsage);
            gaugeMemoryLimitBytes.set(labels, memLimit);
            gaugeMemoryUsageRatio.set(labels, memPercent);

            // Network
            let netRx = result['networks']['eth0']['rx_bytes'];
            let netTx = result['networks']['eth0']['tx_bytes'];
            gaugeNetworkReceivedBytes.set(labels, netRx);
            gaugeNetworkTransmittedBytes.set(labels, netTx);
        }
    } catch (err) {
        console.log(err);
    }
}

// Start Server.
const server = http.createServer((req, res) => {
    // Only allowed to poll prometheus metrics.
    if (req.method !== 'GET' && req.url !== '/metrics') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        return res.end('Not Found.');
    }
    res.setHeader('Content-Type', register.contentType);
    gatherMetrics().then(() => {
        res.end(register.metrics());
    });
}).listen(9487);
server.setTimeout(30000);
