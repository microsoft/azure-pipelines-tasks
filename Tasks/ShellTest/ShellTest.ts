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

//Function to cover all variations of mv function
function mv_all_tests() {
    // Example usage of mv function with different variations
    const sourcePath: string | undefined = tl.getInput('moveSourcePath', true);
    const destinationPath: string | undefined = tl.getInput('moveDestinationPath', true);

    if (!sourcePath || !destinationPath) {
        throw new Error('Source path and destination path are required.');
    }

    // Ensure the source file exists
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file does not exist: ${sourcePath}`);
    }
    // Move a file from source to destination
    tl.mv(sourcePath + '/MyProject.csproj', destinationPath + '/MyProject.csproj');
    console.log('Moved file from source to destination');

    // Move a directory
    tl.mv(sourcePath + '/src', destinationPath + '/src');
    console.log('Moved directory from source to destination');

    // Move a file with force option
    tl.mv(sourcePath + '/MyProject.sln', destinationPath + '/MyProject.sln', '-f');
    console.log('Moved file with force option');

    // Move a file with no-clobber option
    tl.mv(sourcePath + '/Pipeline2.yml', destinationPath + '/Pipeline2.yml', '-n');
    console.log('Moved file with no-clobber option');

    // Move a file with force and no-clobber options
    tl.mv(sourcePath + '/Program.cs', destinationPath + '/Program.cs', '-fn');
    console.log('Moved file with force and no-clobber options');

    // Move a file with options and continue on error
    tl.mv(sourcePath + '/README.md', destinationPath + '/README.md', '-fn', true);
    console.log('Moved file with options and continue on error');

}

function move() {
    try {
        const sourcePath: string | undefined = tl.getInput('moveSourcePath', true);
        const destinationPath: string | undefined = tl.getInput('moveDestinationPath', true);

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


// Function to test ls command with different variations
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

    console.log("----------------------------------------------------------------");
    // Using ls with '.' as the path'
    console.log(".");
    const files7 = tl.ls('.');
    console.log('Files with "." as path:', files7);

    console.log("----------------------------------------------------------------");
    // Using ls with '..' as the path'
    console.log("..");
    const files8 = tl.ls('..');
    console.log('Files with ".." as path:', files8);

    console.log("----------------------------------------------------------------");
    // Using ls with an invalid path - ls: no such file or directory: invalidPath - IN SHELL CASE
    console.log("invalidPath");
    try {
        const files9 = tl.ls('invalidPath');
        console.log('Files with invalid path:', files9);
    } catch (e) {
        console.log('****Invalid path****');
    }

    console.log("----------------------------------------------------------------");
    // Using ls with an empty path
    console.log("emptyPath");
    try {
        const files10 = tl.ls('');
        console.log('Files with empty path:', files10);
    } catch (e) {
        console.log('****Empty path****');
    }

    console.log("----------------------------------------------------------------");
    // Using ls with an undefined path
    console.log("undefinedPath");
    try {
        const files11 = tl.ls(undefined);
        console.log('Files with undefined path:', files11);
    } catch (e) {
        console.log('****Undefined path****');
    }

    console.log("----------------------------------------------------------------");
    // Using ls with invalid options - stderr: 'ls: option not recognized: Z' - IN SHELL CASE
    console.log("invalidOptions -Z");
    try {
        const files12 = tl.ls('-Z', directoryPath);
        console.log('Files with invalid options:', files12);
    } catch (e) {
        console.log('****Invalid options****');
    }

    console.log("----------------------------------------------------------------");
    // Using ls with invalid options - ERROR - stderr: 'ls: option not recognized: r', IN SHELL CASE
    console.log("invalidOptions -rZ");
    try {
        const files12 = tl.ls('-rZ', directoryPath);
        console.log('Files with invalid options:', files12);
    } catch (e) {
        console.log('****Invalid options****');
    }

    console.log("----------------------------------------------------------------");
    // Using ls with empty path array - SAME in both cases
    console.log("emptyPathArray");
    try {
        const files13 = tl.ls([]);
        console.log('Files with empty path array:', files13);
    } catch (e) {
        console.log('****Empty path array****');
    }

    console.log("----------------------------------------------------------------");
    // Using ls with './src' as the path' - working same in both cases
    console.log("./src - relative path");
    const files14 = tl.ls('./src');
    console.log('Files with "./src" as path:', files14);
}

// Function to test pushd and popd functions
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

// Function to test cp command
function cp_cmd() {
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

// Function to test new implementation of cp command
function Test_cp_cmd_new_implementation() {
    // Example usage of cp function with different variations
    const sourcePath: string | undefined = tl.getInput('sourcePath', true);
    const destinationPath: string | undefined = tl.getInput('destinationPath', true);

    if (!sourcePath || !destinationPath) {
        throw new Error('Source path and destination path are required.');
    }

    // Ensure the source file exists
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file does not exist: ${sourcePath}`);
    }
    ls();
    // Copy a file from source to destination
    tl.cp(sourcePath + '/MyProject.csproj', destinationPath + '/MyProject.csproj');
    console.log('Copied file from source to destination');
    console.log("----------------------------------------------------------------");

    tl.cp('-n', sourcePath + '/MyProject.csproj', destinationPath + '/MyProject.csproj');
    console.log('MyProject with -n after already copying in previous step');
    console.log("----------------------------------------------------------------");

    // Copy a directory recursively
    tl.cp('-r', sourcePath + '/src', destinationPath + '/src');
    console.log('Copied directory recursively');
    console.log("----------------------------------------------------------------");

    // // Copy a file with force option
    // tl.cp('-f', sourcePath + '/MyProject.sln', destinationPath+ '/MyProject.sln');
    // console.log('Copied file with force option');
    // console.log("----------------------------------------------------------------");
    ls();
    // Copy a file with no-clobber option
    tl.cp('-n', sourcePath + '/Pipeline2.yml', destinationPath);//+ '/Pipeline2.yml');
    console.log('Copied file with no-clobber option');
    console.log("----------------------------------------------------------------");

    // Copy a file with recursive, force, and no-clobber options
    tl.cp('-frn', sourcePath + '/PowerShell_Pipeline.yml', destinationPath);//+ '/PowerShell_Pipeline.yml');
    console.log('Copied file with recursive, force, and no-clobber options');
    console.log("----------------------------------------------------------------");
    ls();
    // Copy a file with options and continue on error
    tl.cp(sourcePath + '/Program.cs', destinationPath + '/Program.cs', '-r', true);
    console.log('Copied file with options and continue on error');
    console.log("----------------------------------------------------------------");

    // Copy a file with options, continue on error, and retry count
    tl.cp(sourcePath + '/README.md', destinationPath + '/README.md', '-f', true, 3);
    console.log('Copied file with options, continue on error, and retry count');
    console.log("----------------------------------------------------------------");
    ls();
    // Copy a file with recursive, force, and no-clobber options
    tl.cp('-FR', sourcePath + '/ShellTestPipeline.yml', destinationPath + '/ShellTestPipeline.yml');
    console.log('Copied file with recursive, force, and no-clobber options');
    console.log("----------------------------------------------------------------");
    ls();
    // Copy a file with options and continue on error
    tl.cp(sourcePath + '/Test Pipeline 1.yml', destinationPath + '/Test Pipeline 1.yml', '-frn', true);
    console.log('Copied file with options and continue on error');
    console.log("----------------------------------------------------------------");
    ls();
    // Copy a file with options, continue on error, and retry count
    tl.cp(sourcePath + '/Tests.cs', destinationPath + '/Tests.cs', '-frn', true, 3);
    console.log('Copied file with options, continue on error, and retry count');
    console.log("----------------------------------------------------------------");

    // Copy a file with options as the first parameter
    tl.cp('-FRN', sourcePath + '/TestsPipeline.yml', destinationPath + '/TestsPipeline.yml', true, 3);
    console.log('Copied file with options as the first parameter, continue on error, and retry count');
    console.log("----------------------------------------------------------------");

    // Copy a file using relative path for source path
    tl.cp('-frn', './WindowsMachineFileCopyPipeline.yml', destinationPath + '/WindowsMachineFileCopyPipeline.yml');
    console.log('Copied file using relative path for source path');
    console.log("----------------------------------------------------------------");

}

// Function to test old implementation of cp command - SHELL CASE
// Less variations avaialble in old implementation as options are 
// present as 3rd parameter in function definition
function Test_cp_cmd_old_SHELL_CASE() {
    // Example usage of cp function with different variations
    const sourcePath = tl.getInput('sourcePath', true);
    const destinationPath = tl.getInput('destinationPath', true);
    if (!sourcePath || !destinationPath) {
        throw new Error('Source path and destination path are required.');
    }
    // Ensure the source file exists
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Source file does not exist: ${sourcePath}`);
    }
    // Copy a file from source to destination
    tl.cp(sourcePath + '/MyProject.csproj', destinationPath + '/MyProject.csproj');
    console.log('Copied file from source to destination');
    console.log("----------------------------------------------------------------");
    // Copy a directory recursively
    tl.cp(sourcePath + '/src', destinationPath + '/src', '-r');
    console.log('Copied directory recursively');
    console.log("----------------------------------------------------------------");
    // Copy a file with force option
    tl.cp(sourcePath + '/MyProject.sln', destinationPath + '/MyProject.sln', '-f');
    console.log('Copied file with force option');
    console.log("----------------------------------------------------------------");
    // Copy a file with no-clobber option
    tl.cp(sourcePath + '/Pipeline2.yml', destinationPath, '-n'); //+ '/Pipeline2.yml');
    console.log('Copied file with no-clobber option');
    console.log("----------------------------------------------------------------");
    // Copy a file with recursive, force, and no-clobber options
    tl.cp(sourcePath + '/PowerShell_Pipeline.yml', destinationPath, '-frn'); //+ '/PowerShell_Pipeline.yml');
    console.log('Copied file with recursive, force, and no-clobber options');
    console.log("----------------------------------------------------------------");
    // Copy a file with options and continue on error
    tl.cp(sourcePath + '/Program.cs', destinationPath + '/Program.cs', '-r', true);
    console.log('Copied file with options and continue on error');
    console.log("----------------------------------------------------------------");
    // Copy a file with options, continue on error, and retry count
    tl.cp(sourcePath + '/README.md', destinationPath + '/README.md', '-f', true, 3);
    console.log('Copied file with options, continue on error, and retry count');
    console.log("----------------------------------------------------------------");
    // Copy a file with recursive, force, and no-clobber options
    tl.cp(sourcePath + '/ShellTestPipeline.yml', destinationPath + '/ShellTestPipeline.yml', '-fr');
    console.log('Copied file with recursive, force, and no-clobber options');
    console.log("----------------------------------------------------------------");
    // Copy a file with options and continue on error
    tl.cp(sourcePath + '/Test Pipeline 1.yml', destinationPath + '/Test Pipeline 1.yml', '-frn', true);
    console.log('Copied file with options and continue on error');
    console.log("----------------------------------------------------------------");
    // Copy a file with options, continue on error, and retry count
    tl.cp(sourcePath + '/Tests.cs', destinationPath + '/Tests.cs', '-frn', true, 3);
    console.log('Copied file with options, continue on error, and retry count');
    console.log("----------------------------------------------------------------");
    // Copy a file with options as the first parameter
    tl.cp(sourcePath + '/TestsPipeline.yml', destinationPath + '/TestsPipeline.yml', '-frn', true, 3);
    console.log('Copied file with options as the first parameter, continue on error, and retry count');
    console.log("----------------------------------------------------------------");
    // Copy a file using relative path for source path
    tl.cp('./WindowsMachineFileCopyPipeline.yml', destinationPath + '/WindowsMachineFileCopyPipeline.yml', '-frn');
    console.log('Copied file using relative path for source path');
    console.log("----------------------------------------------------------------");
}

// Function to test rmRF command
function Test_rmRF_cmd() {
    const removePath: string | undefined = tl.getInput('removePath', true);
    if (!removePath) {
        throw new Error('remove path is required.');
    }
    if (!fs.existsSync(removePath)) {
        throw new Error(`Source file does not exist: ${removePath}`);
    }
    tl.rmRF(removePath);
    console.log(`Removed file: ${removePath}`);
}

// mv_all_tests();
// Test_cp_cmd_new_implementation();
// Test_cp_cmd_old_SHELL_CASE();
// changeWorkingDirectory();
// cp_cmd();
// Test_rmRF_cmd();
// move();
TestLScmd();

function run() {
    // move();
    console.log("------------------------------------------LS-------------------------------------------");
    ls();
    console.log("--------------------------------------pushD_and_popD--------------------------------------");
    Test_pushD_and_popD();
    console.log("-------------------------------------------cp_cmd---------------------------------------");
    cp_cmd();
    console.log("-------------------------------------------move------------------------------------------");
    move();
    console.log("------------------------------------------rmRF_cmd---------------------------------------");
    Test_rmRF_cmd();
    console.log("------------------------------------------CD--------------------------------------------");
    changeWorkingDirectory();
}

// run();