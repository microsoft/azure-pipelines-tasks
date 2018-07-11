"use strict";

import fs = require('fs');
import path = require('path');
import os = require('os');
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import ContainerConnection from "./containerconnection";
var uuidV4 = require('uuid/v4');

function translateDirectoryPath(bashPath: string, directoryPath: string): string {
    let bashPwd = tl.tool(bashPath)
        .arg('--noprofile')
        .arg('--norc')
        .arg('-c')
        .arg('pwd');
    let bashPwdOptions = <tr.IExecOptions>{
        cwd: directoryPath,
        failOnStdErr: true,
        errStream: process.stdout,
        outStream: process.stdout,
        ignoreReturnCode: false
    };
    let pwdOutput = '';
    bashPwd.on('stdout', (data) => {
        pwdOutput += data.toString();
    });
    bashPwd.execSync(bashPwdOptions);
    pwdOutput = pwdOutput.trim();
    if (!pwdOutput) {
        throw new Error(tl.loc('JS_TranslatePathFailed', directoryPath));
    }

    return `${pwdOutput}`;
}

export function bashRun() {
    
    let input_failOnStderr = true;
    let input_filePath: string;
    let input_arguments: string;
    let input_script: string;
    let input_targetType: string = tl.getInput('type') || '';
    if (input_targetType.toUpperCase() == 'FILEPATH') {
        input_filePath = tl.getPathInput('filePath', /*required*/ true);
        if (!tl.stats(input_filePath).isFile()) {
            throw new Error(tl.loc('JS_InvalidFilePath', input_filePath));
        }

        input_arguments = tl.getInput('scriptArguments') || '';
    }
    else {
        input_script = tl.getInput('script', false) || '';
    }

    // Generate the script contents.
    console.log(tl.loc('GeneratingScript'));
    let bashPath: string = tl.which('bash', true);
    let contents: string;
    if (input_targetType.toUpperCase() == 'FILEPATH') {
        // Translate the target file path from Windows to the Linux file system.
        let targetFilePath: string;
        if (process.platform == 'win32') {
            targetFilePath = translateDirectoryPath(bashPath, path.dirname(input_filePath)) + '/' + path.basename(input_filePath);
        }
        else {
            targetFilePath = input_filePath;
        }

        contents = `. '${targetFilePath.replace("'", "'\\''")}' ${input_arguments}`.trim();
        console.log(tl.loc('JS_FormattedCommand', contents));
    }
    else {
        contents = input_script;

        // Print one-liner scripts.
        if (contents.indexOf('\n') < 0 && contents.toUpperCase().indexOf('##VSO[') < 0) {
            console.log(tl.loc('JS_ScriptContents'));
            console.log(contents);
        }
    }

    let tempDirectory = tl.getVariable('agent.tempDirectory');
    tl.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
    let fileName = uuidV4() + '.sh';
    let filePath = path.join(tempDirectory, fileName);
    fs.writeFileSync(
        filePath,
        contents,
        { encoding: 'utf8' });

    // Translate the script file path from Windows to the Linux file system.
    if (process.platform == 'win32') {
        filePath = translateDirectoryPath(bashPath, tempDirectory) + '/' + fileName;
    }

    // Create the tool runner.
    let bash = tl.tool(bashPath)
        .arg('--noprofile')
        .arg('--norc')
        .arg(filePath);
    let options = <tr.IExecOptions>{           
        failOnStdErr: false,
        errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
        outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
        ignoreReturnCode: true
    };

    // Listen for stderr.
    let stderrFailure = false;
    if (input_failOnStderr) {
        bash.on('stderr', (data) => {
            stderrFailure = true;
        });
    }

    // Run bash.
    return bash.exec(options).then((value: number) => {
        // Fail on exit code.
        if (value !== 0) {
            throw new Error(tl.loc('JS_ExitCode', value));            
        }

        // Fail on stderr.
        if (stderrFailure) {
            throw new Error(tl.loc('JS_Stderr'));            
        }

        return value;
    });
}