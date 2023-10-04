const util = require('./ci-util');
const fs = require('fs');
const path = require('path');
var crypto = require('crypto');

const fileToJson = util.fileToJson;
const buildTasksPath = util.buildTasksPath;
const GITHUB_LINK = 'https://github.com/microsoft/azure-pipelines-tasks/blob/master/docs/migrateNode16.md';

/**
 * Function walking through directories and looking for 
 * libRegExp in directory name, if found will put full path to
 * result array 
 * @param {String} dirPath 
 * @param {RegExp} libRegExp 
 * @returns Array<Path>
 */
function findLib(dirPath, libRegExp) {
    const stack = [dirPath];
    const foundedLibPaths = [];
    while (stack.length) {
        const scanningPath = stack.pop();
        if (!fs.statSync(scanningPath).isDirectory()) continue;

        const packages = fs.readdirSync(scanningPath, { encoding: 'utf-8' })
        for (let packagePath of packages) {
            const nextPath = path.join(scanningPath, packagePath);
            if (packagePath[0] === '.' || packagePath[0] == '@') continue;

            if (libRegExp.test(packagePath)) foundedLibPaths.push(nextPath)
            else stack.push(nextPath)
        }
    }

    return foundedLibPaths;
}

/**
 * Function iterates over the given array to find 
 * which tasks have multiple task lib packages
 * @param {Array} scanningTask 
 * @returns Array<Object>
 */
function findWithFsFromPaths(scanningTask) {
    const foundedTasks = [];
    for (let task of scanningTask) {
        const taskPath = task.taskPath
        const reg = new RegExp('azure-pipelines-task-lib')
        const result = findLib(path.join(taskPath, 'node_modules'), reg);
        if (result.length > 1) {
            const foundedPaths = result.map((path) => path.replace(buildTasksPath, ''));
            foundedTasks.push({
                task: task.taskName,
                locations: foundedPaths
            })
        }
    }

    return foundedTasks;
}

/** 
 * Function checks that the task has node handlers
 * It looking node handler in the task.json for the following executors:
 * execution, prejobexecution, postjobexecution
 * @param {Object} taskDefinition - task.json as object
 * @return {Array} - array of handlers
 */
function isNodeHandlerExists(taskDefinition) {
    const executors = ['execution', 'prejobexecution', 'postjobexecution'];
    const existingExecutors = Object.keys(taskDefinition).filter((key) => executors.includes(key));
    return existingExecutors.some((executor) => {
        return Object.keys(taskDefinition[executor]).some((handler) => handler.toLocaleLowerCase().indexOf('node') > -1);
    });
}

/**
 * Function looking for multiple azure-pipelines-task-lib versions
 * in builded tasks, in case if package found multiple times throw error
 * Note: now function compares only for tasks which have Node10 and Node16 in their task.json
 */
function findNonUniqueTaskLib() {
    const taskPaths = fs.readdirSync(buildTasksPath, { encoding: 'utf-8' })
    const scanningTasks = [];
    for (let taskName of taskPaths) {
        // Skip Common packages
        if (taskName.toLocaleLowerCase().indexOf('common') > -1) continue;

        const fullPath = path.join(buildTasksPath, taskName);
        const taskJsonPath = path.join(fullPath, 'task.json');
        // Skip files, check only directories which contains task.json
        if (!fs.statSync(fullPath).isDirectory()) continue;
        if (!fs.existsSync(taskJsonPath)) continue;

        const taskDefinition = fileToJson(taskJsonPath);

        // Check that task has node handlers
        const isExists = isNodeHandlerExists(taskDefinition);
        if (!isExists) continue;

        const { Minor: minor, Major: major, Patch: patch } = taskDefinition.version;
        scanningTasks.push({
            taskName: `${taskName}@${major}.${minor}.${patch}`,
            taskPath: fullPath
        });
    }

    const haveDependencies = findWithFsFromPaths(scanningTasks);
    if (haveDependencies.length > 0) {
        console.log(`##vso[task.logissue type=error;sourcepath=ci/check-tasks.js;linenumber=109;]The following tasks have duplicate azure-pipelines-task-lib: 
            ${JSON.stringify(haveDependencies, null, 2)}
            Please examine the following link: ${GITHUB_LINK}`);
        process.exit(1);
    }

    console.log('No duplicates found.');
    return null;
}

function analyzePowershellTasks() {
    let output = '';
    if (process.platform !== 'win32') {
        console.log('The powershell check is only supported on Windows. Skipping...');
        return;
    }

    try {
        const pwshScriptPath = path.join(__dirname, 'check-powershell-syntax.ps1');
        output = util.run(`powershell -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted ${pwshScriptPath} ${buildTasksPath}`, true);
    } catch (e) {
        console.log(`##vso[task.logissue type=error;sourcepath=ci/check-tasks.js;linenumber=123;]Please check the tasks, seems like they have invalid PowerShell syntax.`)
        process.exit(1);
    }
}

// findNonUniqueTaskLib();
analyzePowershellTasks();