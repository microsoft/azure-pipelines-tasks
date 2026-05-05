const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const run = require('../ci/ci-util').run;
const semver = require('semver');

const currentSprint = parseInt(process.env['SPRINT']);
const repoRoot = path.join(__dirname, '..');

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

    // Tasks that have a _generated/ mirror always carry at least one variant
    // (e.g. <Task>_Node24) whose patch sits one above the source's Default.
    // A naive +1 bump on the source therefore collides with the variant slot
    // and BuildConfigGen aborts with
    //   "inputVersion ... must not be less or equal to maxVersion ...".
    // Bumping by +2 in that case leaves room for BuildConfigGen to roll the
    // map forward (Default -> source, variant -> source+1).
    const taskName = taskPath.replace(/^Tasks\//, '');
    const hasGeneratedMirror = fs.existsSync(
        path.join(__dirname, '..', '_generated', `${taskName}.versionmap.txt`)
    );
    const patchIncrement = hasGeneratedMirror ? 2 : 1;

    if (taskJson.version.Minor === minor) {
        taskJson.version.Patch = taskJson.version.Patch + patchIncrement;
        taskLocJson.version.Patch = taskLocJson.version.Patch + patchIncrement;
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

/**
 * After bumping Tasks/<X>/task.json, run `node make.js build --task <list>`
 * for tasks with _generated/ mirrors. This invokes BuildConfigGen
 * (--write-updates) and regenerates en-US resjson, keeping _generated/ and
 * Strings/ in sync with the bumped task.json.
 *
 * TF_BUILD is unset because CLI.build refuses to run in CI; the pipeline's
 * build job still runs serverBuild with full validation.
 */
function syncGeneratedTasks(tasksPaths) {
    const generatedDir = path.join(repoRoot, '_generated');
    if (!fs.existsSync(generatedDir)) {
        console.log('No _generated directory found; skipping rebuild.');
        return;
    }

    const generatedEntries = fs.readdirSync(generatedDir);

    const taskNames = tasksPaths
        .map(p => p.replace(/^Tasks\//, ''))
        .filter(name => {
            if (generatedEntries.includes(name)) return true;
            if (generatedEntries.includes(`${name}.versionmap.txt`)) return true;
            return generatedEntries.some(e => e.startsWith(`${name}_`));
        });

    if (taskNames.length === 0) {
        console.log('No tasks with _generated/ mirrors require rebuild.');
        return;
    }

    const taskPattern = taskNames.length === 1
        ? taskNames[0]
        : `{${taskNames.join(',')}}`;
    console.log(`Running 'node make.js build --task ${taskPattern}' to sync _generated/ and en-US resjson.`);

    const childEnv = { ...process.env };
    delete childEnv.TF_BUILD;

    // Use spawnSync without a shell so the brace pattern is passed as a
    // single argv to node (avoids bash brace-expansion). make.js' --task
    // uses minimatch, which understands brace expansion natively.
    const result = spawnSync(
        process.execPath,
        ['make.js', 'build', '--task', taskPattern],
        {
            cwd: repoRoot,
            stdio: 'inherit',
            env: childEnv
        }
    );

    if (result.status !== 0) {
        throw new Error(`make.js build failed with exit code ${result.status}`);
    }
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

    // Sync _generated/ and en-US resjson with the bumped task.json.
    syncGeneratedTasks(tasksPaths);
}

main();