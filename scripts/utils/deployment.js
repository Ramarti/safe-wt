const { readFileSync, writeFileSync } = require('fs');

function readDeployment(networkName) {
    const deployment = JSON.parse(readFileSync('./.deployments.json'));
    if (!deployment[networkName]) {
        deployment[networkName] = {};
    }
    return deployment;
}

function writeDeployment(deployment) {
    return writeFileSync('./.deployments.json', JSON.stringify(deployment, null, 2));
}

module.exports = { readDeployment, writeDeployment };
