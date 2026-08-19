'use strict';

const fs = require('fs');
const path = require('path');
const { rm } = require('shelljs');

function cleanNodeDistribution(nodeDir) {
    if (!nodeDir || !fs.existsSync(nodeDir)) {
        console.log(`cleanNodeDistribution: skipping, directory not found: ${nodeDir}`);
        return;
    }

    console.log(`Removing unused components (npm, corepack, headers, docs) from: ${nodeDir}`);

    const pathsToRemove = process.platform === 'win32'
        ? [
            path.join(nodeDir, 'npm'),
            path.join(nodeDir, 'npm.cmd'),
            path.join(nodeDir, 'npx'),
            path.join(nodeDir, 'npx.cmd'),
            path.join(nodeDir, 'corepack'),
            path.join(nodeDir, 'corepack.cmd'),
            path.join(nodeDir, 'node_modules'),
            path.join(nodeDir, 'CHANGELOG.md'),
            path.join(nodeDir, 'README.md'),
        ]
        : [
            path.join(nodeDir, 'bin', 'npm'),
            path.join(nodeDir, 'bin', 'npx'),
            path.join(nodeDir, 'bin', 'corepack'),
            path.join(nodeDir, 'lib', 'node_modules'),
            path.join(nodeDir, 'include'),
            path.join(nodeDir, 'share'),
            path.join(nodeDir, 'CHANGELOG.md'),
            path.join(nodeDir, 'README.md'),
        ];

    for (const componentPath of pathsToRemove) {
        try {
            const stats = fs.lstatSync(componentPath, { throwIfNoEntry: false });
            if (!stats) {
                continue;
            }
            rm('-rf', componentPath);
        } catch (err) {
            console.warn(`cleanNodeDistribution: failed to remove ${componentPath}: ${err.message}`);
        }
    }

    console.log(`Completed removing unused components from downloaded Node.js distribution.`);
}

module.exports = { cleanNodeDistribution };
