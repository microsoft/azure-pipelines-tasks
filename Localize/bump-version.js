const fs = require('fs');
const os = require('os');
const path = require('path');
const run = require('../ci/ci-util').run;

const currentSprint = process.env['SPRINT'];

function getChangedFilesList() {
    const result = run('git --no-pager diff --name-only Localization..master').split('\n');
    console.log('>>>>>>>>>>>>>>>>>');
    return result;
}

function getTasksPaths(paths) {
    const taskFolder = 'Tasks/';
    const exclusions = ['Common'];

    let tasksPaths = new Set();
    paths.filter(p => p.startsWith(taskFolder))
        .map(p => p.slice(0, p.indexOf('/', taskFolder.length)))
        .forEach(p => tasksPaths.add(p));

    for (let excludedTask of exclusions) {
        tasksPaths.delete(`${taskFolder}${excludedTask}`);
    }
    return Array.from(tasksPaths);
}

function bumpTaskVersion(taskPath) {
    const taskJsonPath = path.join(__dirname, '..', taskPath, 'task.json');
    let taskJson = JSON.parse(fs.readFileSync(taskJsonPath));

    const taskLocJsonPath = path.join(__dirname, '..', taskPath, 'task.loc.json');
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
        taskJson.version.Minor = currentSprint;
        taskLocJson.version.Minor = currentSprint;
    }

    fs.writeFileSync(taskJsonPath, JSON.stringify(taskJson, null, 4));
    fs.writeFileSync(taskLocJsonPath, JSON.stringify(taskLocJson, null, 2));

    // Check that task.loc and task.loc.json versions match
    if ((taskJson.version.Major !== taskLocJson.version.Major) ||
        (taskJson.version.Minor !== taskLocJson.version.Minor) ||
        (taskJson.version.Patch !== taskLocJson.version.Patch)) {
        console.log(`versions dont match for task '${taskName}', task json: ${JSON.stringify(taskJson.version)} task loc json: ${JSON.stringify(taskLocJson.version)}`);
    }
}

function main() {
    const fileList = getChangedFilesList(); // string[]
    const tasksPaths = getTasksPaths(fileList) // string[]

    tasksPaths.forEach(taskPath => {
        bumpTaskVersion(taskPath);
    });
    /*
    const commonPackages = getCommonPacks(fileList) // string[]

    commonPackages.forEach(packagePath => {
        bumpPackageVersion(packagePath);
    });
    */
}

main();