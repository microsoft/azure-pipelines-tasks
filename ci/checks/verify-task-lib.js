const fs = require('fs');
const path = require('path');

const VSTS_TASK_LIB = 'vsts-task-lib';
const AZURE_PIPELINES_TASK_LIB = 'azure-pipelines-task-lib';
const PACKAGE_LOCK_JSON = 'package-lock.json';
const NPM_SHRINKWRAP_JSON = 'npm-shrinkwrap.json';
const rootDirectory = path.resolve(__dirname, '..', '..');
const pathToTasks = path.resolve(rootDirectory, 'Tasks');
const tasks = fs.readdirSync(pathToTasks).filter(task => task != 'Common');
const taskPattern = process.argv[2];
const tasksToCheck = taskPattern ? tasks.filter(task => taskPattern.includes(task)) : tasks;
const sourceBranch = process.env['SYSTEM_PULLREQUEST_SOURCEBRANCH'];

function parseJsonFromPath(...args) {
    const pathToJson = path.resolve(...args);
    if (fs.existsSync(pathToJson)) {
        return JSON.parse(fs.readFileSync(pathToJson, 'utf-8'));
    }
}

function chechTaskLibVersion () {
    let warningMessage = '';
    for (const task of tasksToCheck) {
        const taskPackageLockJson = parseJsonFromPath(pathToTasks, task, PACKAGE_LOCK_JSON) || parseJsonFromPath(pathToTasks, task, NPM_SHRINKWRAP_JSON);
        if (!taskPackageLockJson) continue;
        const taskDependencies = taskPackageLockJson.dependencies;
        if (!taskDependencies) continue;
        const taskDependenciesNames = Object.keys(taskDependencies);
        if (taskDependenciesNames.includes(VSTS_TASK_LIB)) warningMessage += `\nThe "${task}" task dependencies include "${VSTS_TASK_LIB}" which is not supported anymore; change it to "${AZURE_PIPELINES_TASK_LIB}" to resolve this issue.\n`;
    }
    if (warningMessage) {
        const isError = sourceBranch && sourceBranch != 'master';
        const messageType = isError ? 'error' : 'warning';
        console.log(`##vso[task.logissue type=${messageType}]"${VSTS_TASK_LIB}" is used instead of "${AZURE_PIPELINES_TASK_LIB}"`);
        console.log(warningMessage);
        if (isError) console.log('##vso[task.complete result=Failed]');
    }
}

chechTaskLibVersion();
