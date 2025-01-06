const { run } = require('./ci-util');
const { resolve } = require('node:path');
const { readFileSync } = require('node:fs');
const { existsSync } = require('fs');

const cwd = process.cwd();
const packageLocks = run(`git --no-pager diff --name-only origin/master`).split('\n').filter(x => x.endsWith('package-lock.json')).map(x => resolve(cwd, x));
const incorrectPackageLocks = [];

for (const packageLock of packageLocks) {
    if (existsSync(packageLock) && readFileSync(packageLock, 'utf8').indexOf('registry.npmjs.org') !== -1) {
        incorrectPackageLocks.push(packageLock);
    }
}

if (incorrectPackageLocks.length !== 0) {
    console.error(`The package-lock.json files listed below are cuurently pointing to registry.npmjs.org:\n\t${incorrectPackageLocks.map(x => `- ${x}`).join('\n\t')}`);
    console.error('\nPlease ensure that all dependencies are installed from the registry:\nhttps://pkgs.dev.azure.com/mseng/PipelineTools/_packaging/PipelineTools_PublicPackages/npm/registry/');
    console.error(`\nIf you encounter any issues, a potential fix would be to remove node_modules folder in the directory containing the problematic package-lock.json file.\nAfterward, initiate the npm install command from the project's root directory.`);
    process.exit(1);
}
