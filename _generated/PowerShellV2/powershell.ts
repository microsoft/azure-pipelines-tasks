import fs = require('fs');
import path = require('path');
import os = require('os');
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import { validateFileArgs } from './helpers';
import { ArgsSanitizingError } from './errors';
import { emitTelemetry } from 'azure-pipelines-tasks-utility-common/telemetry';
import { spawn, exec } from 'child_process';
var uuidV4 = require('uuid/v4');


function getActionPreference(vstsInputName: string, defaultAction: string = 'Default', validActions: string[] = ['Default', 'Stop', 'Continue', 'SilentlyContinue']) {
    let result: string = tl.getInput(vstsInputName, false) || defaultAction;

    if (validActions.map(actionPreference => actionPreference.toUpperCase()).indexOf(result.toUpperCase()) < 0) {
        throw new Error(tl.loc('JS_InvalidActionPreference', vstsInputName, result, validActions.join(', ')))
    }

    return result
}

async function startNamedPiped(pipeName: string, connectedService: string) {
    // Path to your PowerShell script
    const content = `
# Create a security descriptor to allow Everyone to access the pipe
$pipePath = "/tmp/$pipeName" 

# Create a named pipe with the specified security
$pipe = New-Object System.IO.Pipes.NamedPipeServerStream("${pipeName}","InOut")

# Set permissions using chmod
bash -c "chmod 777 $pipePath" 

Write-Host "Waiting for a connection..."
$pipe.WaitForConnection()

Write-Host "Client connected."

# Send a message to the client
$message = "Hello from the server!"
$writer = New-Object System.IO.StreamWriter($pipe)
$writer.WriteLine($message)
$writer.Flush()

# Close the pipe
$writer.Close()
$pipe.Close()
    `;
    
    // Spawn the PowerShell process
    let powershell = tl.tool(tl.which('pwsh') || tl.which('powershell') || tl.which('pwsh', true));

    powershell.arg('-ExecutionPolicy')
                  .arg('Bypass')
                  .arg('-Command')
                  .arg(content);

    let options = <tr.IExecOptions>{
        failOnStdErr: false,
        errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
        outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
        ignoreReturnCode: true
    };

    // Execute the PowerShell command and capture the output
    const result = await powershell.exec(options);

    // Check the result and set the task result
    if (result === 0) {
        tl.setResult(tl.TaskResult.Succeeded, `Script executed successfully.`);
    } else {
        tl.setResult(tl.TaskResult.Failed, `Script execution failed with exit code ${result}.`);
    }
    
    // Handle PowerShell exit
    powershell.on('close', (code) => {
        console.log(`PowerShell process exited with code ${code}`);
    });
    
    return powershell;
}

async function run() {
    let server;
    try {
        // Get inputs.

        const connectedServiceName = tl.getInput("ConnectedServiceName", false);        
        console.log("connectedServiceName: " + connectedServiceName);

        let pipe_name : string = "praval";
        server = startNamedPiped(pipe_name, connectedServiceName);

        let input_errorActionPreference: string = getActionPreference('errorActionPreference', 'Stop');
        let input_warningPreference: string = getActionPreference('warningPreference', 'Default');
        let input_informationPreference: string = getActionPreference('informationPreference', 'Default');
        let input_verbosePreference: string = getActionPreference('verbosePreference', 'Default');
        let input_debugPreference: string = getActionPreference('debugPreference', 'Default');
        let input_progressPreference: string = getActionPreference('progressPreference', 'SilentlyContinue');
        let input_showWarnings = tl.getBoolInput('showWarnings', false);
        let input_failOnStderr = tl.getBoolInput('failOnStderr', false);
        let input_ignoreLASTEXITCODE = tl.getBoolInput('ignoreLASTEXITCODE', false);
        let input_workingDirectory = tl.getPathInput('workingDirectory', /*required*/ true, /*check*/ true);
        let input_filePath: string;
        let input_arguments: string;
        let input_script: string;
        let input_targetType: string = tl.getInput('targetType') || '';
        
        if (input_targetType.toUpperCase() == 'FILEPATH') {
            input_filePath = tl.getPathInput('filePath', /*required*/ true);
            if (!tl.stats(input_filePath).isFile() || !input_filePath.toUpperCase().match(/\.PS1$/)) {
                throw new Error(tl.loc('JS_InvalidFilePath', input_filePath));
            }

            input_arguments = tl.getInput('arguments') || '';
        }
        else if (input_targetType.toUpperCase() == 'INLINE') {
            input_script = tl.getInput('script', false) || '';
        }
        else {
            throw new Error(tl.loc('JS_InvalidTargetType', input_targetType));
        }
        const input_runScriptInSeparateScope = tl.getBoolInput('runScriptInSeparateScope');

        // Generate the script contents.
        console.log(tl.loc('GeneratingScript'));
        let contents: string[] = [];
        if (input_errorActionPreference.toUpperCase() != 'DEFAULT') {
            contents.push(`$ErrorActionPreference = '${input_errorActionPreference}'`);
        }
        if (input_warningPreference.toUpperCase() != 'DEFAULT') {
            contents.push(`$WarningPreference = '${input_warningPreference}'`);
        }
        if (input_informationPreference.toUpperCase() != 'DEFAULT') {
            contents.push(`$InformationPreference = '${input_informationPreference}'`);
        }
        if (input_verbosePreference.toUpperCase() != 'DEFAULT') {
            contents.push(`$VerbosePreference = '${input_verbosePreference}'`);
        }
        if (input_debugPreference.toUpperCase() != 'DEFAULT') {
            contents.push(`$DebugPreference = '${input_debugPreference}'`);
        }
        if (input_progressPreference.toUpperCase() != 'DEFAULT') {
            contents.push(`$ProgressPreference = '${input_progressPreference}'`);
        }

        let script = '';
        if (input_targetType.toUpperCase() == 'FILEPATH') {

            try {
                validateFileArgs(input_arguments);
            }
            catch (error) {
                if (error instanceof ArgsSanitizingError) {
                    throw error;
                }

                emitTelemetry('TaskHub', 'PowerShellV2',
                    {
                        UnexpectedError: error?.message ?? JSON.stringify(error) ?? null,
                        ErrorStackTrace: error?.stack ?? null
                    }
                );
            }

            script = `. '${input_filePath.replace(/'/g, "''")}' ${input_arguments}`.trim();
        } else {
            script = `${input_script}`;
        }

        if (connectedServiceName && connectedServiceName.trim().length > 0) {
            script = `
                function Get-Token {

                    $pipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "${pipe_name}", [System.IO.Pipes.PipeDirection]::InOut)
                    try {
                        $pipe.Connect(5000) # Wait up to 5 seconds for the connection
                        Write-Host "Connected to the server."

                        $writer = New-Object System.IO.StreamWriter($pipe)
                        $reader = New-Object System.IO.StreamReader($pipe)

                        # Send a message to the server
                        $message = "Hello from PowerShell!"
                        $writer.WriteLine($message)
                        $writer.Flush()

                        # Read the response
                        $response = $reader.ReadLine()
                        Write-Host "Received from server: $response"
                    }
                    catch {
                        Write-Host "Error: $_"
                    }
                    finally {
                        $pipe.Dispose()
                    }
                }

                ${script}
            `;
        }

        if (input_showWarnings) {
            script = `
                $warnings = New-Object System.Collections.ObjectModel.ObservableCollection[System.Management.Automation.WarningRecord];
                Register-ObjectEvent -InputObject $warnings -EventName CollectionChanged -Action {
                    if($Event.SourceEventArgs.Action -like "Add"){
                        $Event.SourceEventArgs.NewItems | ForEach-Object {
                            Write-Host "##vso[task.logissue type=warning;]$_";
                        }
                    }
                };
                Get-ChildItem -Recurse $PSScriptRoot | Select Fullname 
                Invoke-Command {${script}} -WarningVariable +warnings;
            `;
        }

        tl.debug(script);

        contents.push(script);
        // log with detail to avoid a warning output.
        tl.logDetail(uuidV4(), tl.loc('JS_FormattedCommand', script), null, 'command', 'command', 0);

        if (!input_ignoreLASTEXITCODE) {
            contents.push(`if (!(Test-Path -LiteralPath variable:\LASTEXITCODE)) {`);
            contents.push(`    Write-Host '##vso[task.debug]$LASTEXITCODE is not set.'`);
            contents.push(`} else {`);
            contents.push(`    Write-Host ('##vso[task.debug]$LASTEXITCODE: {0}' -f $LASTEXITCODE)`);
            contents.push(`    exit $LASTEXITCODE`);
            contents.push(`}`);
        }

        // Write the script to disk.
        tl.assertAgent('2.115.0');
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
        console.log('========================== Starting Command Output ===========================');

        const executionOperator = input_runScriptInSeparateScope ? '&' : '.';
        let powershell = tl.tool(tl.which('pwsh') || tl.which('powershell') || tl.which('pwsh', true))
            .arg('-NoLogo')
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-Command')
            .arg(`${executionOperator} '${filePath.replace(/'/g, "''")}'`);
        let options = <tr.IExecOptions>{
            cwd: input_workingDirectory,
            failOnStdErr: false,
            errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
            outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
            ignoreReturnCode: true
        };

        // Listen for stderr.
        let stderrFailure = false;
        const aggregatedStderr: string[] = [];
        if (input_failOnStderr) {
            powershell.on('stderr', (data: Buffer) => {
                stderrFailure = true;
                aggregatedStderr.push(data.toString('utf8'));
            });
        }

        // Run bash.
        let exitCode: number = await powershell.exec(options);
        // Fail on exit code.
        if (exitCode !== 0) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('JS_ExitCode', exitCode));
        }



        // Fail on stderr.
        if (stderrFailure) {
            tl.setResult(tl.TaskResult.Failed, tl.loc('JS_Stderr'));
            aggregatedStderr.forEach((err: string) => {
                tl.error(err, tl.IssueSource.CustomerScript);
            });
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed');
    }
    finally {
        server.kill();
    }
}

run();
