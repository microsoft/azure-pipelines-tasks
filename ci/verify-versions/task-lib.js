const fs = require('fs');
const path = require('path');

const AZURE_PIPELINE_TASK_LIB = 'azure-pipelines-task-lib';
const NODE_MODULES = 'node_modules';
const PACKAGE_JSON = 'package.json';
const rootDirectory = path.resolve(__dirname, '..', '..');
const pathToTasksBuild = path.resolve(rootDirectory, '_build', 'Tasks');
const pathToCommonNpmPackages = path.resolve(rootDirectory, 'common-npm-packages');
const commonNpmPackages = fs.readdirSync(pathToCommonNpmPackages).filter(folder =>
    fs.statSync(path.resolve(pathToCommonNpmPackages, folder)).isDirectory() && folder != 'build-scripts'
).map(package => parseJsonFromPath(pathToCommonNpmPackages, package, PACKAGE_JSON).name);

function parseJsonFromPath(...args) {
    const pathToJson = path.resolve(...args);
    if (fs.existsSync(pathToJson)) {
        return JSON.parse(fs.readFileSync(pathToJson, 'utf-8'));
    }
}

if (fs.existsSync(pathToTasksBuild)) {
    const tasks = fs.readdirSync(pathToTasksBuild);
    for (const task of tasks) {
        const pathToTask = path.resolve(pathToTasksBuild, task);
        const pathToTaskLib = path.resolve(pathToTask, NODE_MODULES, AZURE_PIPELINE_TASK_LIB);
        if (fs.existsSync(pathToTaskLib)) {
            const taskPackageJson = parseJsonFromPath(pathToTask, PACKAGE_JSON);
            const taskLibPackageJson = parseJsonFromPath(pathToTaskLib, PACKAGE_JSON);
            const dependencies = Object.keys(taskPackageJson.dependencies);
            for (const dependency of dependencies) {
                if (dependency in commonNpmPackages) {
                    const commonPackageJson = parseJsonFromPath(pathToTask, NODE_MODULES, dependency, NODE_MODULES, AZURE_PIPELINE_TASK_LIB, PACKAGE_JSON);
                    if (commonPackageJson && taskLibPackageJson.version != commonPackageJson.version) {
                        throw new Error(`node_modules includes different azure-pipeline-task-lib versions in root and in ${dependency}`);
                    }
                }
            }
        }
    }
}
