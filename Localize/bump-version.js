const fs = require('fs');
const path = require('path');
const run = require('../ci/ci-util').run;
const semver = require('semver');

const currentSprint = parseInt(process.env['SPRINT']);

function getChangedFilesList() {
    return run('git --no-pager diff --name-only Localization..master').split('\n');
}

function getTaskOrPackagePaths(paths, rootFolder, exclusions) {
    let pathSet = new Set();
    paths.filter(p => p.startsWith(rootFolder))
        .map(p => p.slice(0, p.indexOf('/', rootFolder.length)))
        .filter(p => fs.existsSync(path.resolve(p)) && fs.statSync(path.resolve(p)).isDirectory())
        .forEach(p => pathSet.add(p));

    for (let excludedTask of exclusions) {
        pathSet.delete(`${rootFolder}${excludedTask}`);
    }
    return Array.from(pathSet);
}

function getTasksPaths(paths) {
    const taskFolder = 'Tasks/';
    const exclusions = ['Common'];

    return getTaskOrPackagePaths(paths, taskFolder, exclusions);
}

function getCommonPacks(paths) {
    const packFolder = 'common-npm-packages/';
    const exclusions = ['_download', 'node_modules', 'build-scripts'];

    return getTaskOrPackagePaths(paths, packFolder, exclusions);
}

function bumpTaskVersion(taskPath) {
    const taskJsonPath = path.join(__dirname, '..', taskPath, 'task.json');
    const taskLocJsonPath = path.join(__dirname, '..', taskPath, 'task.loc.json');

    if (!fs.existsSync(taskJsonPath) || !fs.existsSync(taskLocJsonPath)) {
        console.log(`Bumping version of ${taskPath} failed: task.json or task.loc.json doesn't exists.`);
        return;
    }

    let taskJson = JSON.parse(fs.readFileSync(taskJsonPath));
    let taskLocJson = JSON.parse(fs.readFileSync(taskLocJsonPath));

    if (typeof taskJson.version.Patch != 'number') {
        throw new Error(`Error processing '${taskJsonPath}'. version.Patch should be a number.`);
    }
    if (taskJson.version.Minor === currentSprint) {
        taskJson.version.Patch = taskJson.version.Patch + 1;
        taskLocJson.version.Patch = taskLocJson.version.Patch + 1;
    } else {
        taskJson.version.Patch = 0;
        taskLocJson.version.Patch = 0;
        taskJson.version.Minor = Number(currentSprint);
        taskLocJson.version.Minor = Number(currentSprint);
    }

    fs.writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 4));
    fs.writeFileSync(taskLocJsonPath, JSON.stringify(taskLocJson, null, 2));
}

function bumpPackageVersion(packPath) {
    const packageJsonPath = path.join(__dirname, '..', packPath, 'package.json');
    const packageLocJsonPath = path.join(__dirname, '..', packPath, 'package.loc.json');

    if (!fs.existsSync(packageJsonPath) || !fs.existsSync(packageLocJsonPath)) {
        console.log(`Bumping version of ${packPath} failed: package.json or package.loc.json doesn't exists.`);
        return;
    }

    let packageJson = JSON.parse(fs.readFileSync(taskJsonPath));
    let packageLocJson = JSON.parse(fs.readFileSync(taskLocJsonPath));

    let version = semver.parse(packageJson.version);
    if (version.minor === currentSprint) {
        version.patch++;
    } else {
        version.minor = currentSprint;
        version.patch = 0;
    }
    packageJson.version = version.format();
    packageLocJson.version = version.format();

    fs.writeFileSync(packageJsonPath, JSON.stringify(taskJson, null, 4));
    fs.writeFileSync(packageLocJsonPath, JSON.stringify(taskLocJson, null, 2));
}

function main() {
    const fileList = getChangedFilesList(); // string[]
    const tasksPaths = getTasksPaths(fileList) // string[]

    /*tasksPaths.forEach(taskPath => {
        bumpTaskVersion(taskPath);
    });*/
    
    const commonPackages = getCommonPacks(fileList) // string[]

    commonPackages.forEach(packagePath => {
        bumpPackageVersion(packagePath);
    });
    
}

main();