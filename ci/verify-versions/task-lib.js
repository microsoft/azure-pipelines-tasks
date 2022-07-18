const fs = require('fs');
const path = require('path');

const AZURE_PIPELINES_TASK_LIB = 'azure-pipelines-task-lib';
const AZURE_PIPELINES_TOOL_LIB = 'azure-pipelines-tool-lib';
const PACKAGE_LOCK_JSON = 'package-lock.json';
const NPM_SHRINKWRAP_JSON = 'npm-shrinkwrap.json';
const rootDirectory = path.resolve(__dirname, '..', '..');
const pathToTasks = path.resolve(rootDirectory, 'Tasks');
const tasks = fs.readdirSync(pathToTasks).filter(task => task != 'Common');
const taskPattern = process.argv[2];
const tasksToCheck = taskPattern ? tasks.filter(task => taskPattern.includes(task)) : tasks;
const sourceBranch = process.env['SYSTEM_PULLREQUEST_SOURCEBRANCH'];
console.log(`Source Branch: ${sourceBranch}`);
const pathToCommonNpmPackages = path.resolve(rootDirectory, 'common-npm-packages');
const commonNpmPackagesFolders = fs.readdirSync(pathToCommonNpmPackages).filter(folder =>
    fs.statSync(path.resolve(pathToCommonNpmPackages, folder)).isDirectory() && folder != 'build-scripts'
);
const commonNpmPackagesNames = commonNpmPackagesFolders.map(package =>
    parseJsonFromPath(pathToCommonNpmPackages, package, PACKAGE_LOCK_JSON).name
);

const stepsToFix = `Follow these steps for each task in the above list to fix this issue:

Open "Tasks/<task-name>/package.json" and make sure that for the "${AZURE_PIPELINES_TASK_LIB}" dependency
and for dependencies which use "${AZURE_PIPELINES_TASK_LIB}" as dependency only the major version is frozen.
Use ^ to freeze only the major version.

Run these commands:

>>> node make.js build --task <task-name>
>>> cd Tasks/<task-name>
>>> rm package-lock.json
>>> rm -Recurse -Force node_modules
>>> npm update

Upgrade "${AZURE_PIPELINES_TASK_LIB}" dependency version in the task or in the related package if they are incompatible.`;

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
        if (!taskDependenciesNames.includes(AZURE_PIPELINES_TASK_LIB)) continue;
        for (const taskDependencyName of taskDependenciesNames) {
            if (!commonNpmPackagesNames.includes(taskDependencyName) && taskDependencyName != AZURE_PIPELINES_TOOL_LIB) continue;
            const commonNpmPackageDependencies = taskDependencies[taskDependencyName].dependencies;
            if (!commonNpmPackageDependencies) continue;
            const commonNpmPackageDependenciesNames = Object.keys(commonNpmPackageDependencies);
            if (!commonNpmPackageDependenciesNames.includes(AZURE_PIPELINES_TASK_LIB)) continue;
            warningMessage += `${task} :: ${taskDependencies[AZURE_PIPELINES_TASK_LIB].version} ---> ${taskDependencyName} :: ${commonNpmPackageDependencies[AZURE_PIPELINES_TASK_LIB].version}\n`;
        }
    }
    if (warningMessage) {
        const isError = sourceBranch && sourceBranch != 'master';
        const messageType = isError ? 'error' : 'warning';
        console.log('\n=============     =============     > > > > > > >     =============     =============\n');
        console.log(`##vso[task.logissue type=${messageType}]"${AZURE_PIPELINES_TASK_LIB}" version is not the same in common npm packages and tasks.`);
        console.log(warningMessage);
        console.log(stepsToFix);
        console.log('\n=============     =============     < < < < < < <     =============     =============\n');
        if (isError) console.log('##vso[task.complete result=Failed]');
    }
}

chechTaskLibVersion();
