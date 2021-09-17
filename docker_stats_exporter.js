#!/usr/bin/env node
'use strict';

// Requirements
const http = require('http');
const prom = require('prom-client');
const Docker = require('dockerode');
const commandLineArgs = require('command-line-args')

// Constants
const appName = 'dockerstats';

// Get args and set options
const argOptions = commandLineArgs([
    { name: 'port', alias: 'p', type: Number, defaultValue: process.env.DOCKERSTATS_PORT || 9487, },
    { name: 'interval', alias: 'i', type: Number, defaultValue: process.env.DOCKERSTATS_INTERVAL || 15, },
    { name: 'hostip', type: String, defaultValue: process.env.DOCKERSTATS_HOSTIP || '', },
    { name: 'hostport', type: Number, defaultValue: process.env.DOCKERSTATS_HOSTPORT || 0, },
    { name: 'collectdefault', type: Boolean, },
]);
const port = argOptions.port;
const interval = argOptions.interval >= 3 ? argOptions.interval : 3;
const dockerIP = argOptions.hostip;
const dockerPort = argOptions.hostport;
const collectDefaultMetrics = process.env.DOCKERSTATS_DEFAULTMETRICS || argOptions.collectdefault;

// Connect to docker
let dockerOptions;
if (dockerIP && dockerPort) {
    dockerOptions = { host: dockerIP, port: dockerPort, };
    console.log(`INFO: Connecting to Docker on ${dockerIP}:${dockerPort}...`);
} else {
    dockerOptions = { socketPath: '/var/run/docker.sock' };
    console.log(`INFO: Connecting to Docker on /var/run/docker.sock...`);
}
const docker = new Docker(dockerOptions);
if (!docker) {
    console.log(`ERROR: Unable to connect to Docker`);
    process.exit(1);
}

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
const gaugeMemoryUsageRssBytes = new prom.Gauge({
    'name': appName + '_memory_usage_rss_bytes',
    'help': 'Memory rss usage in bytes',
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
const gaugeBlockIoReadBytes = new prom.Gauge({
    'name': appName + '_blockio_read_bytes',
    'help': 'Block IO read in bytes',
    'labelNames': ['name', 'id'],
});
const gaugeBlockIoWrittenBytes = new prom.Gauge({
    'name': appName + '_blockio_written_bytes',
    'help': 'Block IO written in bytes',
    'labelNames': ['name', 'id'],
});

// Register all metrics
console.log(`INFO: Registering Prometheus metrics...`);
const register = new prom.Registry();
register.registerMetric(gaugeCpuUsageRatio);
register.registerMetric(gaugeMemoryUsageBytes);
register.registerMetric(gaugeMemoryUsageRssBytes);
register.registerMetric(gaugeMemoryLimitBytes);
register.registerMetric(gaugeMemoryUsageRatio);
register.registerMetric(gaugeNetworkReceivedBytes);
register.registerMetric(gaugeNetworkTransmittedBytes);
register.registerMetric(gaugeBlockIoReadBytes);
register.registerMetric(gaugeBlockIoWrittenBytes);
if (collectDefaultMetrics) {
    prom.collectDefaultMetrics({
        timeout: 5000,
        register: register,
        prefix: appName + '_',
    });
}

// Start gathering metrics
gatherMetrics();
setInterval(gatherMetrics, interval * 1000);

// Start Server.
console.log(`INFO: Starting HTTP server...`);
const server = http.createServer((req, res) => {
    // Only allowed to poll prometheus metrics.
    if (req.method !== 'GET') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        return res.end('Support GET only');
    }
    res.setHeader('Content-Type', register.contentType);
    res.end(register.metrics());
}).listen(port);
server.setTimeout(20000);
console.log(`INFO: Docker Stats exporter listening on port ${port}`);

// Main function to get the metrics for each container
async function gatherMetrics() {
    try {
        // Get all containers
        let containers = await docker.listContainers();
        if (!containers || !Array.isArray(containers) || !containers.length) {
            throw new Error('ERROR: Unable to get containers');
        }

        // Get stats for each container in one go
        let promises = [];
        for (let container of containers) {
            if (container.Id) {
                promises.push(docker.getContainer(container.Id).stats({ 'stream': false, 'decode': true }));
            }
        }
        let results = await Promise.all(promises);

        // Reset all to zero before proceeding
        register.resetMetrics();

        // Build metrics for each container
        for (let result of results) {
            const labels = {
                'name': result['name'].replace('/', ''),
                'id': result['id'].slice(0, 12),
            };

            // CPU
            if (result['cpu_stats'] && result['cpu_stats']['cpu_usage'] && result['precpu_stats'] && result['precpu_stats']['cpu_usage']) {
                let cpuDelta = result['cpu_stats']['cpu_usage']['total_usage'] - result['precpu_stats']['cpu_usage']['total_usage'];
                let systemDelta = result['cpu_stats']['system_cpu_usage'] - result['precpu_stats']['system_cpu_usage'];
                if (systemDelta <= 0) {
                    systemDelta = 1;
                }
                let cpuPercent = parseFloat(((cpuDelta / systemDelta) * result['cpu_stats']['online_cpus'] * 100).toFixed(2));
                gaugeCpuUsageRatio.set(labels, cpuPercent);
            }

            // Memory
            if (result['memory_stats']) {
                let memUsage = result['memory_stats']['usage'];
                let memUsageRss = result['memory_stats']['stats']['rss'];
                let memLimit = result['memory_stats']['limit'];
                if (memLimit <= 0) {
                    memLimit = 1;
                }
                let memPercent = parseFloat(((memUsage / memLimit) * 100).toFixed(2));
                gaugeMemoryUsageBytes.set(labels, memUsage);
                gaugeMemoryUsageRssBytes.set(labels, memUsageRss);
                gaugeMemoryLimitBytes.set(labels, memLimit);
                gaugeMemoryUsageRatio.set(labels, memPercent);
            }

            // Network
            if (result['networks']) {
                if (result['networks']['eth0']) {
                    let netRx = result['networks']['eth0']['rx_bytes'];
                    let netTx = result['networks']['eth0']['tx_bytes'];
                    gaugeNetworkReceivedBytes.set(labels, netRx);
                    gaugeNetworkTransmittedBytes.set(labels, netTx);
                } else if (result['networks']['host']) {
                    let netRx = result['networks']['host']['rx_bytes'];
                    let netTx = result['networks']['host']['tx_bytes'];
                    gaugeNetworkReceivedBytes.set(labels, netRx);
                    gaugeNetworkTransmittedBytes.set(labels, netTx);
                }
            }

            // Block IO
            if (result['blkio_stats']) {
                let ioRead = 0.00;
                let ioWrite = 0.00;
                if (result['blkio_stats']['io_service_bytes_recursive'] && Array.isArray(result['blkio_stats']['io_service_bytes_recursive'])) {
                    for (let io of result['blkio_stats']['io_service_bytes_recursive']) {
                        switch (io['op'].toUpperCase()) {
                            case 'READ':
                                ioRead += io['value'];
                                break;
                            case 'WRITE':
                                ioWrite += io['value'];
                                break;
                        }
                    }
                }
                gaugeBlockIoReadBytes.set(labels, ioRead);
                gaugeBlockIoWrittenBytes.set(labels, ioWrite);
            }
        }
    } catch (err) {
        console.log('ERROR: ' + err);
    }
}

