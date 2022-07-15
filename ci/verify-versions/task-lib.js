const fs = require('fs');
const path = require('path');

const AZURE_PIPELINES_TASK_LIB = 'azure-pipelines-task-lib';
const AZURE_PIPELINES_TOOL_LIB = 'azure-pipelines-tool-lib';
const PACKAGE_LOCK_JSON = 'package-lock.json';
const NPM_SHRINKWRAP_JSON = 'npm-shrinkwrap.json';
const rootDirectory = path.resolve(__dirname, '..', '..');
const pathToTasks = path.resolve(rootDirectory, 'Tasks');
const tasks = fs.readdirSync(pathToTasks).filter(task => task != 'Common');
const pathToCommonNpmPackages = path.resolve(rootDirectory, 'common-npm-packages');
const commonNpmPackagesFolders = fs.readdirSync(pathToCommonNpmPackages).filter(folder =>
    fs.statSync(path.resolve(pathToCommonNpmPackages, folder)).isDirectory() && folder != 'build-scripts'
);
const commonNpmPackagesNames = commonNpmPackagesFolders.map(package =>
    parseJsonFromPath(pathToCommonNpmPackages, package, PACKAGE_LOCK_JSON).name
);

function parseJsonFromPath(...args) {
    const pathToJson = path.resolve(...args);
    if (fs.existsSync(pathToJson)) {
        return JSON.parse(fs.readFileSync(pathToJson, 'utf-8'));
    }
}

function chechTaskLibVersion () {
    console.log('\n==========   ==========   ==========   ==========   ==========   ==========   ==========\n');
    for (const task of tasks) {
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
            console.log(`${task} : ${taskDependencies[AZURE_PIPELINES_TASK_LIB].version} --- ${taskDependencyName} : ${commonNpmPackageDependencies[AZURE_PIPELINES_TASK_LIB].version}`);
        }
    }
    console.log('\n==========   ==========   ==========   ==========   ==========   ==========   ==========\n');
}

chechTaskLibVersion();
