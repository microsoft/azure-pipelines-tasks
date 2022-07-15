const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const AZURE_PIPELINES_TASK_LIB = 'azure-pipelines-task-lib';
const AZURE_PIPELINES_TOOL_LIB = 'azure-pipelines-tool-lib';
const PACKAGE_JSON = 'package.json';
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

function chechTaskLibVersion (update) {
    console.log('\n=============     =============     > > > > > > >     =============     =============\n');
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
            if (!update) continue;
            const taskPackageJson = parseJsonFromPath(pathToTasks, task, PACKAGE_JSON);
            const taskLibVersion = taskPackageJson.dependencies[AZURE_PIPELINES_TASK_LIB];
            if (!taskLibVersion) {
                console.log(`\n${task} does not have ${AZURE_PIPELINES_TASK_LIB} in dependencies, but dependencies have.\n`);
                continue;
            }
            if (!taskLibVersion.startsWith('^')) {
                taskPackageJson.dependencies[AZURE_PIPELINES_TASK_LIB] = '^' + taskLibVersion;
            }
            for (const dep of commonNpmPackagesNames) {
                const commonNpmPackageVersion = taskPackageJson.dependencies[dep];
                if (!commonNpmPackageVersion) continue;
                if (!commonNpmPackageVersion.startsWith('^')) {
                    taskPackageJson.dependencies[dep] = '^' + commonNpmPackageVersion;
                }
            }
            fs.writeFileSync(path.resolve(pathToTasks, task, PACKAGE_JSON), JSON.stringify(taskPackageJson));
            execSync(`pwsh -command "node make.js build --task ${task}; cd Tasks/${task}; rm package-lock.json; rm -Recurse -Force node_modules; npm update"`, { stdio: 'inherit' });
            break;
        }
    }
    console.log('\n=============     =============     < < < < < < <     =============     =============\n');
}

execSync('git clean -d -f -q -x', { stdio: 'inherit' });
execSync('npm i', { stdio: 'inherit' });
chechTaskLibVersion(false);
chechTaskLibVersion(true);
chechTaskLibVersion(false);
