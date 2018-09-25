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
    { name: 'port', alias: 'p', type: Number, defaultValue: 9487, },
    { name: 'hostip', type: String, defaultValue: '', },
    { name: 'hostport', type: Number, defaultValue: 0, }
]);
const port = argOptions.port;
const dockerIP = argOptions.hostip;
const dockerPort = argOptions.hostport;

// Connect to docker
let dockerOptions;
if (dockerIP && dockerPort) {
    dockerOptions = { host: dockerIP, port: dockerPort };
    console.log(`Connecting to Docker on ${dockerIP}:${dockerPort}...`);
} else {
    dockerOptions = { socketPath: '/var/run/docker.sock' };
    console.log(`Connecting to Docker on /var/run/docker.sock...`);
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
console.log(`Registering Prometheus metrics...`);
const register = new prom.Registry();
register.registerMetric(gaugeCpuUsageRatio);
register.registerMetric(gaugeMemoryUsageBytes);
register.registerMetric(gaugeMemoryLimitBytes);
register.registerMetric(gaugeMemoryUsageRatio);
register.registerMetric(gaugeNetworkReceivedBytes);
register.registerMetric(gaugeNetworkTransmittedBytes);
prom.collectDefaultMetrics({
    timeout: 5000,
    register: register,
    prefix: appName + '_',
});

// Start Server.
console.log(`Starting HTTP server...`);
const server = http.createServer((req, res) => {
    // Only allowed to poll prometheus metrics.
    if (req.method !== 'GET') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        return res.end('Support GET only');
    }
    res.setHeader('Content-Type', register.contentType);
    gatherMetrics().then(() => {
        res.end(register.metrics());
    });
}).listen(port);
server.setTimeout(30000);
console.log(`Docker Stats exporter listening on port ${port}`);

// Main function to get the metrics for each container
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
            if (container.Id) {
                promises.push(docker.getContainer(container.Id).stats({ 'stream': false, 'decode': true }));
            }
        }

        // Build metrics for each container
        let results = await Promise.all(promises);
        for (let result of results) {
            const labels = { 
                'name': result['name'].replace('/', ''), 
                'id': result['id'].slice(0, 12),
            };

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
        console.log('ERROR: ' + err);
    }
}

