const fs = require('fs');
const path = require('path');
const semver = require('semver');

const basePath = path.join(__dirname, '..', 'Tasks');
const tasks = fs.readdirSync(basePath).map(x => ({
    name: x,
    path: path.resolve(basePath, x),
})).filter(x => fs.existsSync(path.join(x.path, 'task.json')));

const versionMap = new Map([
    ['Node10', '2.144.0'],
    ['Node16', '2.209.0'],
    ['Node20_1', '3.232.1'],
]);

const problems = [];

for (const task of tasks) {
    const taskJson = JSON.parse(fs.readFileSync(path.join(task.path, 'task.json'), 'utf8'));

    if (!taskJson.hasOwnProperty('execution')) {
        continue;
    }

    const taskMinimumAgentVersion = taskJson.minimumAgentVersion;
    
    if (taskMinimumAgentVersion === undefined) {
        problems.push(`The minimum agent version is not defined in ${task.name} task`);
        continue;
    }
    
    const handlers = Object.keys(taskJson.execution);

    for (const key of versionMap.entries()) {
        if (handlers.includes(key[0]) && semver.gt(taskMinimumAgentVersion, key[1])) {
            break;
        }

        problems.push(`The minimum agent version is not correct for ${key[0]} executor in ${task.name} task, should be min ${key[1]}`);
    }
}

if (problems.length > 0) {
    console.log(problems.join('\n'));
    process.exit(1);
}