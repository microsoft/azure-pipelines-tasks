import fs = require('fs');
import path = require('path');
import tl = require('../../azure-pipelines-task-lib');
var process = require('process');
// "./node_modules/azure-pipelines-task-lib/task"

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

function changeWorkingDirectory(): void {
    let DefaultWorkingDirectory = tl.getVariable("System.DefaultWorkingDirectory");
    const directoryPath: string | undefined = tl.getInput('changeDirectoryPath', true);
    console.log(`original working directory to: ${process.cwd()}`);
    console.log(`CD to: ${directoryPath}`);
    tl.cd(directoryPath);
    DefaultWorkingDirectory = tl.getVariable("System.DefaultWorkingDirectory");
    console.log(`Changed working directory to: ${process.cwd()}`);
}

function move() {
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
    // move();
    console.log("---------------LS------------------");
    ls();
    console.log("---------------CD------------------");
    changeWorkingDirectory();
    console.log("---------------LS------------------");
}

function TestLScmd() {
    const directoryPath: string | undefined = tl.getInput('directoryPath', true);

    if (!directoryPath) {
        throw new Error('Directory path is required.');
    }

    // Ensure the directory exists
    if (!fs.existsSync(directoryPath)) {
        throw new Error(`Directory does not exist: ${directoryPath}`);
    }

    // Using ls with options and multiple paths
    console.log("----------------------------------------------------------------");
    console.log("-RA, directoryPath+bin/Debug/net8.0, directoryPath+src");
    const files1 = tl.ls('-RA', directoryPath + "/bin/Debug/net8.0", directoryPath + "/src");
    console.log('Files with options and multiple paths:', files1);

    console.log("----------------------------------------------------------------");
    // Using ls with options and a single path
    console.log("-RA, directoryPath");
    const files2 = tl.ls('-RA', directoryPath);
    console.log('Files with options and single path:', files2);

    console.log("----------------------------------------------------------------");
    // Using ls with a single path
    console.log("directoryPath");
    const files3 = tl.ls(directoryPath);
    console.log('Files with single path:', files3);

    console.log("----------------------------------------------------------------");
    // Using ls with multiple paths
    console.log("directoryPath+bin/Debug/net8.0, directoryPath+src");
    const files4 = tl.ls(directoryPath + "/bin/Debug/net8.0", directoryPath + "/src");
    console.log('Files with multiple paths:', files4);

    console.log("----------------------------------------------------------------");
    // Using ls with options and an array of paths
    console.log("-RA, [ directoryPath, directoryPath+src ]");
    const files5 = tl.ls('-RA', [directoryPath, directoryPath + "/src"]);
    console.log('Files with options and array of paths:', files5);

    console.log("----------------------------------------------------------------");
    // Using ls with an array of paths
    console.log("[ directoryPath, directoryPath+src ]");
    const files6 = tl.ls([directoryPath, directoryPath + "/src"]);
    console.log('Files with array of paths:', files6);
}
function Test_pushD_and_popD() {
    let DefaultWorkingDirectory = tl.getVariable("System.DefaultWorkingDirectory");
    // Example usage of pushd and popd functions

    // Initial working directory
    // const initialDir = cwd();
    console.log('Initial working directory:', DefaultWorkingDirectory);

    // Push a new directory onto the stack
    console.log("-------------pushd to src-------------");
    let newPath = process.cwd() + "/src";
    try {
        const stack1 = tl.pushd(newPath);
        console.log('Directory stack after pushd:', stack1);
        tl.debug(`Task root path set to ${newPath}`);
    } catch (e) {
        console.log(tl.loc('RootPathNotExist', newPath));
        tl.setResult(tl.TaskResult.Failed, `The  path ${newPath} does not exist.`);
    }
    console.log('Current working directory after pushd :', process.cwd());

    // Push another directory onto the stack
    console.log("-------------pushd to dir1-------------");
    newPath = process.cwd() + "/dir1";
    try {
        const stack1 = tl.pushd(newPath);
        console.log('Directory stack after pushd:', stack1);
        tl.debug(`Task root path set to ${newPath}`);
    } catch (e) {
        console.log(tl.loc('RootPathNotExist', newPath));
        tl.setResult(tl.TaskResult.Failed, `The  path ${newPath} does not exist.`);
    }
    console.log('Current working directory after pushd :', process.cwd());
    

    // Pop the last directory off the stack
    console.log("-------------popd-------------");
    try {
        const stack3 = tl.popd();
        console.log('Directory stack after popd:', stack3);
    } catch (e) {
        console.log(tl.loc('RootPathNotExist', newPath));
        tl.setResult(tl.TaskResult.Failed, `The  path ${newPath} does not exist.`);
    }
    console.log('Current working directory after pushd :', process.cwd());

    // console.log('Current working directory after popd:', DefaultWorkingDirectory);

    // Pop the initial directory off the stack
    console.log("-------------popd-------------");
    try {
        const stack4 = tl.popd();
        console.log('Directory stack after popd:', stack4);
    } catch (e) {
        console.log(tl.loc('RootPathNotExist', newPath));
        tl.setResult(tl.TaskResult.Failed, `The  path ${newPath} does not exist.`);
    }
    console.log('Current working directory after pushd :', process.cwd());
}

function cp_cmd(){
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
    tl.cp('-r', sourcePath, destinationPath);

    // Verify the file has been moved
    if (fs.existsSync(destinationPath)) {
        console.log(`File moved successfully to ${destinationPath}`);
    } else {
        throw new Error('File move failed');
    }
}


// TestLScmd();
// Test_pushD_and_popD();
// changeWorkingDirectory();
cp_cmd();