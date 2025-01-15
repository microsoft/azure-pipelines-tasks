import fs = require('fs');
import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
// import tr = require('azure-pipelines-task-lib/toolrunner');
// import { emitTelemetry } from 'azure-pipelines-tasks-utility-common/telemetry';
// import { ArgsSanitizingError } from './utils/errors';
// import { validateFileArgs } from './helpers';
// var uuidV4 = require('uuid/v4');

function ls() {
    try {
        // Get the directory path from task variables
        const directoryPath: string | undefined = tl.getInput('directoryPath', true);

        if (!directoryPath) {
            throw new Error('Directory path is required.');
        }

        // Ensure the directory exists
        if (!fs.existsSync(directoryPath)) {
            throw new Error(`Directory does not exist: ${directoryPath}`);
        }

        // List the contents of the directory
        const contents = tl.ls(directoryPath);

        // Output the contents
        console.log(`Contents of ${directoryPath}:`);
        contents.forEach(item => {
            console.log(item);
        });

    } catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed', true);
    }
}

function move () {
    try {
        const sourcePath: string | undefined = tl.getInput('sourcePath', true);
        const destinationPath: string | undefined = tl.getInput('destinationPath', true);

        if (!sourcePath || !destinationPath) {
            throw new Error('Source path and destination path are required.');
        }

        // Ensure the source file exists
        if (!fs.existsSync(sourcePath)) {
            throw new Error(`Source file does not exist: ${sourcePath}`);
        }

        // Move the file from source to destination
        tl.mv(sourcePath, destinationPath, '-f');

        // Verify the file has been moved
        if (fs.existsSync(destinationPath)) {
            console.log(`File moved successfully to ${destinationPath}`);
        } else {
            throw new Error('File move failed');
        }
    }
    catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed', true);
    }
}

function run() {
    ls();
}

run();