const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { get } = require('node:https');
const { resolve } = require('node:path');
const { styleText } = require('node:util');

const TASKS_PATH = 'Tasks/';
const skippedDependencies = [
    "@types/",
    "typescript"
];

async function checkAvailableDependencies() {
    const tasks = new Set(execSync('git diff --name-only origin/master').toString('utf-8').split('\n').filter(x => x.includes(TASKS_PATH)).map(x => x.split('/')[1]));
    const outdatedDependencies = [];

    console.log('Found tasks:', tasks.size);
    let i = 0;

    for (const task of tasks) {
        i++;
        console.log(`\x1b[A\x1b[KChecking task ${i}/${tasks.size}: ${task}`);

        const { dependencies = {}, devDependencies = {} } = JSON.parse(readFileSync(resolve(TASKS_PATH, task, "package.json")));
        const allDeps = { ...dependencies, ...devDependencies };

        for (const [dependency, currentVersion] of Object.entries(allDeps)) {
            if (skippedDependencies.find(x => dependency.includes(x))) continue;

            const latestVersion = await getLatestVersion(dependency);

            if (latestVersion && latestVersion !== currentVersion.replace(/^[^\d]*/, '')) {
                outdatedDependencies.push({
                    task,
                    dependency,
                    currentVersion,
                    latestVersion
                });
            }
        }
    }

    if (process.env["TF_BUILD"] == "True" && outdatedDependencies.length > 0) {
        console.log('##vso[task.logissue type=warning]Found the outdated dependencies in changed tasks. Please see the warnings in the "Check dependencies for updates" task');
    }

    outdatedDependencies.forEach(x => {
        if (process.env["TF_BUILD"] == "True") {
            console.log(`##vso[task.logissue type=warning]The task "${x.task}" has dependency "${x.dependency}" that can be updated from ${x.currentVersion} to ${x.latestVersion}`);
        } else {
            console.warn(styleText('yellow', `Warning: The task "${x.task}" has dependency "${x.dependency}" that can be updated from ${styleText('red', x.currentVersion)} to ${styleText('greenBright', x.latestVersion)}`));
        }
    });
}

async function getLatestVersion(dependency) {
    const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(dependency)}/latest`);
    const json = await response.json();
    return json.version;
}

checkAvailableDependencies();