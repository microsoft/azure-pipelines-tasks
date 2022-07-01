var fs = require('fs');
var path = require('path');

const AZURE_PIPELINE_TASK_LIB = 'azure-pipelines-task-lib';
const NODE_MODULES = 'node_modules';
const PACKAGE_JSON = 'package.json';

function parseJsonFromPath(...args) {
    if (fs.existsSync(path.resolve(...args)))
        return JSON.parse(fs.readFileSync(path.resolve(...args), 'utf-8'))
}

const pathToTasksBuild = path.resolve(__dirname, '..', '..', '_build', 'Tasks')
if(fs.existsSync(pathToTasksBuild)) {
    verifyTasks(fs.readdirSync(pathToTasksBuild))
}

function verifyTasks(tasks) {
    tasks.forEach(task => {
        const pathToTask = path.resolve(__dirname, '..', '..', '_build', 'Tasks', task)
        if (fs.existsSync(path.resolve(pathToTask, NODE_MODULES, AZURE_PIPELINE_TASK_LIB))) {
            const mainPackageJson = parseJsonFromPath(pathToTask, PACKAGE_JSON);
            const mainTaskLibPackageJSON = parseJsonFromPath(pathToTask, NODE_MODULES, AZURE_PIPELINE_TASK_LIB, PACKAGE_JSON);
            const dependencies = Object.keys(mainPackageJson.dependencies)
            dependencies.forEach(dependency => {
                if (dependency.match('common')) {
                    const commonPackageJSON = parseJsonFromPath(pathToTask, NODE_MODULES, dependency, NODE_MODULES, AZURE_PIPELINE_TASK_LIB, PACKAGE_JSON);
                    if (commonPackageJSON && mainTaskLibPackageJSON.version !== commonPackageJSON.version)
                    throw new Error(`node_modules includes different azure-pipeline-task-lib versions in root and in ${dependency}`)
                }
            })
        }
    })
}