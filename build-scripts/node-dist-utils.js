'use strict';

const fs = require('fs');
const path = require('path');
const { rm } = require('shelljs');

function cleanNodeDistribution(nodeDir) {
    console.log(`Removing unused components (npm, corepack, headers, docs) from downloaded Node.js distribution.`);

    const pathsToRemove = process.platform === 'win32'
        ? [
            path.join(nodeDir, 'node_modules'),
            path.join(nodeDir, 'npm'),
            path.join(nodeDir, 'npm.cmd'),
            path.join(nodeDir, 'npx'),
            path.join(nodeDir, 'npx.cmd'),
            path.join(nodeDir, 'corepack'),
            path.join(nodeDir, 'corepack.cmd'),
            path.join(nodeDir, 'CHANGELOG.md'),
            path.join(nodeDir, 'README.md'),
        ]
        : [
            path.join(nodeDir, 'lib', 'node_modules'),
            path.join(nodeDir, 'bin', 'npm'),
            path.join(nodeDir, 'bin', 'npx'),
            path.join(nodeDir, 'bin', 'corepack'),
            path.join(nodeDir, 'include'),
            path.join(nodeDir, 'share'),
            path.join(nodeDir, 'CHANGELOG.md'),
            path.join(nodeDir, 'README.md'),
        ];

    for (const componentPath of pathsToRemove) {
        if (fs.existsSync(componentPath)) {
            rm('-rf', componentPath);
        }
    }

    console.log(`Completed removing unused components from downloaded Node.js distribution.`);
}

module.exports = { cleanNodeDistribution };
