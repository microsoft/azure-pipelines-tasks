const fs = require('fs');
const path = require('path');
const run = require('../ci/ci-util').run;
const semver = require('semver');

const currentSprint = parseInt(process.env['SPRINT']);

function getChangedFilesList() {
    return run('git --no-pager diff --name-only origin/master..Localization').split('\n');
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

function bumpTaskVersion(taskPath, minor) {
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
    if (taskJson.version.Minor === minor) {
        taskJson.version.Patch = taskJson.version.Patch + 1;
        taskLocJson.version.Patch = taskLocJson.version.Patch + 1;
    } else {
        taskJson.version.Patch = 0;
        taskLocJson.version.Patch = 0;
        taskJson.version.Minor = minor;
        taskLocJson.version.Minor = minor;
    }

    fs.writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 4));
    fs.writeFileSync(taskLocJsonPath, JSON.stringify(taskLocJson, null, 2));
}

function bumpPackageVersion(packPath, minor) {
    const packageJsonPath = path.join(__dirname, '..', packPath, 'package.json');
    const packageLocJsonPath = path.join(__dirname, '..', packPath, 'package-lock.json');

    if (!fs.existsSync(packageJsonPath) || !fs.existsSync(packageLocJsonPath)) {
        console.log(`Bumping version of ${packPath} failed: package.json or package-lock.json doesn't exists.`);
        return;
    }

    let packageJson = JSON.parse(fs.readFileSync(packageJsonPath));
    let packageLocJson = JSON.parse(fs.readFileSync(packageLocJsonPath));

    let version = semver.parse(packageJson.version);

    if (version.minor === minor) {
        version.patch++;
    } else {
        version.minor = minor;
        version.patch = 0;
    }
    packageJson.version = version.format();
    packageLocJson.version = version.format();

    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 4));
    fs.writeFileSync(packageLocJsonPath, JSON.stringify(packageLocJson, null, 2));
}

function main() {
    if (!currentSprint) {
        throw new Error('SPRINT variable is not set!')
    }

    const fileList = getChangedFilesList();

    const tasksPaths = getTasksPaths(fileList)
    const commonPackages = getCommonPacks(fileList)

    tasksPaths.forEach(taskPath => {
        bumpTaskVersion(taskPath, currentSprint);
    });

    commonPackages.forEach(packagePath => {
        bumpPackageVersion(packagePath, currentSprint);
    });
}

main();