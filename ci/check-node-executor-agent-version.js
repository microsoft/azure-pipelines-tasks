const fs = require('fs');
const path = require('path');
const semver = require('semver');
const { resolveTaskList } = require('./ci-util');

const argv = require('minimist')(process.argv.slice(2));

// --task "@({tasks_names})"
if (!argv.task) {
  console.log(`$(task_pattern) variable is empty or not set. Aborting...`);
  process.exit(0);
};

const handleAllTasks = argv.task === 'all';
const changedTasks = [];

if (!handleAllTasks) {
    changedTasks.push(...resolveTaskList(argv.task));

    if (changedTasks.length === 0) {
        console.log(`There are no changed tasks`);
        process.exit(0);
    }
};

const basePath = path.join(__dirname, '..', 'Tasks');
const tasks = fs.readdirSync(basePath)
    .filter(x => changedTasks.includes(x) || handleAllTasks)
    .map(x => ({ name: x, path: path.resolve(basePath, x) }))
    .filter(x => fs.existsSync(path.join(x.path, 'task.json')));

const versionMap = new Map([
    ['Node10', '2.144.0'],
    ['Node16', '2.209.0'],
    ['Node20_1', '3.232.1'],
]);

const problems = [];

for (let i = 0; i < tasks.length; i++) {
    const taskJson = JSON.parse(fs.readFileSync(path.join(tasks[i].path, 'task.json'), 'utf8'));

    if (!taskJson.hasOwnProperty('execution')) {
        continue;
    }

    const taskMinimumAgentVersion = taskJson.minimumAgentVersion;

    const handlers = Object.keys(taskJson.execution);
    
    if (taskMinimumAgentVersion === undefined) {
        if (handlers.includes('Node10')) {
            continue;
        }

        problems.push(`${i + 1}. ${tasks[i].name} - the minimum agent version is not defined in ${tasks[i].name} task.\n\tLocation: ${tasks[i].path}\n`);
        continue;
    }

    for (const [ nodeVersion, agentVersion ] of versionMap.entries()) {
        if (handlers.includes(nodeVersion) && semver.gte(taskMinimumAgentVersion, agentVersion)) {
            break;
        }

        problems.push(`${i + 1}. ${tasks[i].name} - the minimum agent version is not correct for ${nodeVersion} executor in ${tasks[i].name} task, should be min ${agentVersion}\n\tLocation: ${tasks[i].path}\n`);
        break;
    }
}

if (problems.length > 0) {
    console.log(`Found ${problems.length} issues to address:\n`);
    console.log(problems.join('\n'));
    console.log('Please address these issues and attempt the process again.');
    console.log('For guidance on resolving these problems, you can use the following documentation: https://github.com/microsoft/azure-pipelines-tasks/blob/master/docs/migrateNode20.md#specify-minimumagentversion');
    process.exit(1);
}