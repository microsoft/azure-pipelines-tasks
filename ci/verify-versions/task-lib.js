const fs = require('fs');
const path = require('path');

const AZURE_PIPELINE_TASK_LIB = 'azure-pipelines-task-lib';
const PACKAGE_LOCK_JSON = 'package-lock.json';
const rootDirectory = path.resolve(__dirname, '..', '..');
const pathToTasks = path.resolve(rootDirectory, 'Tasks');
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

const tasks = fs.readdirSync(pathToTasks).filter(task => task != 'Common');
for (const task of tasks) {
    const taskPackageLockJson = parseJsonFromPath(pathToTasks, task, PACKAGE_LOCK_JSON);
    if (!taskPackageLockJson) continue;
    const taskDependencies = taskPackageLockJson.dependencies;
    const taskDependenciesNames = Object.keys(taskDependencies);
    if (taskDependenciesNames.includes(AZURE_PIPELINE_TASK_LIB)) {
        for (const taskDependencyName of taskDependenciesNames) {
            if (commonNpmPackagesNames.includes(taskDependencyName)) {
                const dependencyFolder = commonNpmPackagesFolders[commonNpmPackagesNames.indexOf(taskDependencyName)];
                const commonPackageDependencies = parseJsonFromPath(pathToCommonNpmPackages, dependencyFolder, PACKAGE_LOCK_JSON).dependencies;
                const commonPackageDependenciesNames = Object.keys(commonPackageDependencies);
                if (commonPackageDependenciesNames.includes(AZURE_PIPELINE_TASK_LIB)) {
                    const taskLibVersion = {
                        inTask: taskDependencies[AZURE_PIPELINE_TASK_LIB].version,
                        inCommonPackage: commonPackageDependencies[AZURE_PIPELINE_TASK_LIB].version
                    };
                    if (taskLibVersion.inTask != taskLibVersion.inCommonPackage) {
                        throw new Error(`azure-pipelines-task-lib version is different in the "${task}" task (${taskLibVersion.inTask}) and in the "${taskDependencyName}" common npm package (${taskLibVersion.inCommonPackage}).`);
                    }
                }
            }
        }
    }
}
