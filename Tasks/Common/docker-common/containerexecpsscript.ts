"use strict";

import fs = require('fs');
import path = require('path');
import os = require('os');
import * as tl from "vsts-task-lib/task";
import * as tr from "vsts-task-lib/toolrunner";
import ContainerConnection from "./containerconnection";
var uuidV4 = require('uuid/v4');

export function psRun() {

    let input_errorActionPreference: string = 'Stop';
    let input_failOnStderr = true;
    let input_ignoreLASTEXITCODE = false;
    let input_filePath: string;
    let input_arguments: string;
    let input_script: string;
    let input_targetType: string = tl.getInput('type') || '';
    if (input_targetType.toUpperCase() == 'FILEPATH') {
        input_filePath = tl.getPathInput('filePath', /*required*/ true);
        if (!tl.stats(input_filePath).isFile() || !input_filePath.toUpperCase().match(/\.PS1$/)) {
            throw new Error(tl.loc('JS_InvalidFilePath', input_filePath));
        }

        input_arguments = tl.getInput('scriptArguments') || '';
    }
    else {
        input_script = tl.getInput('script', false) || '';
    }

    // Generate the script contents.
    console.log(tl.loc('GeneratingScript'));
    let contents: string[] = [];
    contents.push(`$ErrorActionPreference = '${input_errorActionPreference}'`);
    if (input_targetType.toUpperCase() == 'FILEPATH') {
        contents.push(`. '${input_filePath.replace("'", "''")}' ${input_arguments}`.trim());
        console.log(tl.loc('JS_FormattedCommand', contents[contents.length - 1]));
    }
    else {
        contents.push(input_script);
    }

    if (!input_ignoreLASTEXITCODE) {
        contents.push(`if (!(Test-Path -LiteralPath variable:\LASTEXITCODE)) {`);
        contents.push(`    Write-Host '##vso[task.debug]$LASTEXITCODE is not set.'`);
        contents.push(`} else {`);
        contents.push(`    Write-Host ('##vso[task.debug]$LASTEXITCODE: {0}' -f $LASTEXITCODE)`);
        contents.push(`    exit $LASTEXITCODE`);
        contents.push(`}`);
    }

    // Write the script to disk.  
    let tempDirectory = tl.getVariable('agent.tempDirectory');
    tl.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);
    let filePath = path.join(tempDirectory, uuidV4() + '.ps1');
    fs.writeFileSync(
        filePath,
        '\ufeff' + contents.join(os.EOL), // Prepend the Unicode BOM character.
        { encoding: 'utf8' });            // Since UTF8 encoding is specified, node will
    //                                    // encode the BOM into its UTF8 binary sequence.

    // Run the script.
    //
    // Note, prefer "pwsh" over "powershell". At some point we can remove support for "powershell".
    //
    // Note, use "-Command" instead of "-File" to match the Windows implementation. Refer to
    // comment on Windows implementation for an explanation why "-Command" is preferred.
    let powershell = tl.tool(tl.which('pwsh') || tl.which('powershell') || tl.which('pwsh', true))
        .arg('-NoLogo')
        .arg('-NoProfile')
        .arg('-NonInteractive')
        .arg('-Command')
        .arg(`. '${filePath.replace("'", "''")}'`);
    let options = <tr.IExecOptions>{           
        failOnStdErr: false,
        errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
        outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
        ignoreReturnCode: true
    };

    // Listen for stderr.
    let stderrFailure = false;
    if (input_failOnStderr) {
        powershell.on('stderr', (data) => {
            stderrFailure = true;
        });
    }

    // Run ps.
    return powershell.exec(options).then((value: number) => {
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