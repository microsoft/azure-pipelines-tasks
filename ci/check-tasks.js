const util = require('./ci-util');
const fs = require('fs');
const path = require('path');

const fileToJson = util.fileToJson;
const buildTasksPath = util.buildTasksPath;

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
 * Function looking for multiple azure-pipelines-task-lib versions
 * in builded tasks, in case if package found multiple times throw error
 * Note: now function compares only for tasks which have Node10 and Node16 in their task.json
 */
function findNonUniqueTaskLib() {
    const lookedHandlers = ['node16', 'node10']
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
        // Skip if task don't have execution handlers
        if (!taskDefinition.execution || typeof taskDefinition.execution !== 'object') continue;

        // Check that task has lookedHandlers
        const handlers = Object.keys(taskDefinition.execution).filter(handler => lookedHandlers.indexOf(handler.toLocaleLowerCase()) !== -1);
        if (handlers.length !== lookedHandlers.length) continue;

        const { Minor: minor, Major: major, Patch: patch } = taskDefinition.version;
        scanningTasks.push({
            taskName: `${taskName}@${major}.${minor}.${patch}`,
            taskPath: fullPath
        });
    }

    const haveDependencies = findWithFsFromPaths(scanningTasks);
    if (haveDependencies.length > 0) {
        throw new Error('The following tasks have duplicate azure-pipelines-task-lib: ' + JSON.stringify(haveDependencies, null, 2));
    }

    console.log('No duplicates found.');
    return null;
}

findNonUniqueTaskLib();