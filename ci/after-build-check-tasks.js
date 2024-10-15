const util = require('./ci-util');
const fs = require('fs');
const path = require('path');
const semver = require('semver');

const fileToJson = util.fileToJson;
const buildTasksPath = util.buildTasksPath;
const logToPipeline = util.logToPipeline;
const GITHUB_LINK = 'https://github.com/microsoft/azure-pipelines-tasks/blob/master/docs/validation-errors.md';

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
 * which tasks have package in node_modules
 * @param {Array} scanningTask - array of tasks
 * @param {RegExp} regExp - regular expression to find package 
 * @param {Boolean} includeAll - flag to include all founded packages
 * @returns Array<Object>
 */
function findPackageUsingRegExp(scanningTask, regExp, includeAll = false) {
    const foundedTasks = [];
    for (let task of scanningTask) {
        const taskPath = task.taskPath
        const result = findLib(path.join(taskPath, 'node_modules'), regExp);
        if ((!includeAll && result.length > 1) || includeAll) {
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
 * Function to get all built tasks
 * @returns {Array<Tasks>} - array of tasks with path and versions
 */
function getBuiltTasks() {
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

    return scanningTasks;
}

/**
 * Function looking for multiple azure-pipelines-task-lib versions
 * in builded tasks, in case if package found multiple times throw error
 * Note: now function compares only for tasks which have Node10 and Node16 in their task.json
 */
function findNonUniqueTaskLib() {
    const taskLibSection = "#findnonuniquetasklib-section"
    const scanningTasks = getBuiltTasks();
    const reg = new RegExp('azure-pipelines-task-lib')
    const haveDependencies = findPackageUsingRegExp(scanningTasks, reg, false);
    if (haveDependencies.length > 0) {
        logToPipeline('error', `The following tasks have duplicate azure-pipelines-task-lib:\n${JSON.stringify(haveDependencies, null, 2)}`);
    logToPipeline('error', `Please examine the following link: ${GITHUB_LINK + taskLibSection}`);
        process.exit(1);
    }

    logToPipeline('info', 'No duplicates found');
    return null;
}

function analyzePowershellTasks() {
    let output = '';
    if (process.platform !== 'win32') {
        logToPipeline('info', 'The powershell check is only supported on Windows. Skipping...');
        return;
    }

    try {
        const pwshScriptPath = path.join(__dirname, 'check-powershell-syntax.ps1');
        output = util.run(`powershell -NoLogo -Sta -NoProfile -NonInteractive -ExecutionPolicy Unrestricted ${pwshScriptPath} ${buildTasksPath}`, true);
    } catch (e) {
        logToPipeline('error', 'Please check the tasks, seems like they have invalid PowerShell syntax.');
        process.exit(1);
    }
}

function findIncompatibleAgentBase() {
    const minAgentBaseVersion = '6.0.2';
    const agentBaseSection = "#findincompatibleagentbase-section"
    const scanningTasks = getBuiltTasks();
    const reg = new RegExp('agent-base')
    const agentBaseTasks = findPackageUsingRegExp(scanningTasks, reg, true);
    const errors = [];

    for (const { task, locations } of agentBaseTasks) {
        if (!locations.length) continue;

        for (const agentBasePath of locations) {
            const packagePath = path.join(buildTasksPath, agentBasePath, 'package.json');
            if (!fs.existsSync(packagePath)) {
                logToPipeline('warning', `The following task has no package.json file: ${task}`);
                continue;
            }
            
            const agentBaseVersion = fileToJson(packagePath).version;
            if (semver.lt(agentBaseVersion, minAgentBaseVersion)) {
                errors.push({ task, agentBasePath, agentBaseVersion });
            }
        }
    }

    if (errors.length) {
        logToPipeline('warning', `The following tasks have incompatible agent-base versions, please use agent-base >= ${minAgentBaseVersion}:\n${JSON.stringify(errors, null, 2)}`);
        logToPipeline('error', `Please examine the following link: ${GITHUB_LINK + agentBaseSection}`);
        process.exit(1);
    }
}

logToPipeline("section", "Start findNonUniqueTaskLib")
findNonUniqueTaskLib();
logToPipeline("section", "Start analyzePowershellTasks")
analyzePowershellTasks();
logToPipeline("section", "Start findIncompatibleAgentBase")
findIncompatibleAgentBase();
