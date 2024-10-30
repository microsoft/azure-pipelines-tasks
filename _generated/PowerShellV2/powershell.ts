import fs = require('fs');
import path = require('path');
import os = require('os');
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import { validateFileArgs } from './helpers';
import { ArgsSanitizingError } from './errors';
import { emitTelemetry } from 'azure-pipelines-tasks-utility-common/telemetry';
var uuidV4 = require('uuid/v4');
const { exec } = require('child_process');
import * as msal from "@azure/msal-node";
import { getFederatedToken } from "azure-pipelines-tasks-artifacts-common/webapi";
import * as net from 'net';

export async function getAccessTokenViaWorkloadIdentityFederation(connectedService: string): Promise<string> {

  // workloadidentityfederation
  const authorizationScheme = tl
    .getEndpointAuthorizationSchemeRequired(connectedService)
    .toLowerCase();

  // get token using workload identity federation or managed service identity
  if (authorizationScheme !== "workloadidentityfederation") {
    throw new Error(`Authorization scheme ${authorizationScheme} is not supported.`);
  }

  // use azure devops webapi to get federated token using service connection
  var servicePrincipalId: string =
    tl.getEndpointAuthorizationParameterRequired(connectedService, "serviceprincipalid");

  var servicePrincipalTenantId: string =
    tl.getEndpointAuthorizationParameterRequired(connectedService, "tenantid");

  const authorityUrl =
    tl.getEndpointDataParameter(connectedService, "activeDirectoryAuthority", true) ?? "https://login.microsoftonline.com/";

  tl.debug(`Getting federated token for service connection ${connectedService}`);

  var federatedToken: string = await getFederatedToken(connectedService);

  tl.debug(`Got federated token for service connection ${connectedService}`);

  // exchange federated token for service principal token (below)
  return await getAccessTokenFromFederatedToken(servicePrincipalId, servicePrincipalTenantId, federatedToken, authorityUrl);
}

async function getAccessTokenFromFederatedToken(
    servicePrincipalId: string,
    servicePrincipalTenantId: string,
    federatedToken: string,
    authorityUrl: string
  ): Promise<string> {
    const AzureDevOpsResourceId = "499b84ac-1321-427f-aa17-267ca6975798";
  
    // use msal to get access token using service principal with federated token
    tl.debug(`Using authority url: ${authorityUrl}`);
    tl.debug(`Using resource: ${AzureDevOpsResourceId}`);
  
    const config: msal.Configuration = {
      auth: {
        clientId: servicePrincipalId,
        authority: `${authorityUrl.replace(/\/+$/, "")}/${servicePrincipalTenantId}`,
        clientAssertion: federatedToken,
      },
      system: {
        loggerOptions: {
          loggerCallback: (level, message, containsPii) => {
            tl.debug(message);
          },
          piiLoggingEnabled: false,
          logLevel: msal.LogLevel.Verbose,
        },
      },
    };
  
    const app = new msal.ConfidentialClientApplication(config);
  
    const request: msal.ClientCredentialRequest = {
      scopes: [`${AzureDevOpsResourceId}/.default`],
      skipCache: true,
    };
  
    const result = await app.acquireTokenByClientCredential(request);
  
    tl.debug(`Got access token for service principal ${servicePrincipalId}`);
  
    return result?.accessToken;
}

function getActionPreference(vstsInputName: string, defaultAction: string = 'Default', validActions: string[] = ['Default', 'Stop', 'Continue', 'SilentlyContinue']) {
    let result: string = tl.getInput(vstsInputName, false) || defaultAction;

    if (validActions.map(actionPreference => actionPreference.toUpperCase()).indexOf(result.toUpperCase()) < 0) {
        throw new Error(tl.loc('JS_InvalidActionPreference', vstsInputName, result, validActions.join(', ')))
    }

    return result
}

async function startNamedPiped(pipeName: string, connectedService: string) {
    const content = `

            # Create a security descriptor to allow Everyone to access the pipe
            $pipePath = "/tmp/$pipeName" 

            # Create a named pipe with the specified security
            $pipe = New-Object System.IO.Pipes.NamedPipeServerStream("${pipeName}","InOut")

            # Set permissions using chmod
            # bash -c "chmod 777 $pipePath" 

            Write-Host "Waiting for a connection..."
            $pipe.WaitForConnection()

            Import-Module /home/vsts/work/_tasks/PowerShell_e213ff0f-5d5c-4791-802d-52ea3e7be1f1/2.247.56/ps_modules/VstsAzureRestHelpers_ -Force
            Import-Module /home/vsts/work/_tasks/PowerShell_e213ff0f-5d5c-4791-802d-52ea3e7be1f1/2.247.56/ps_modules/VstsAzureHelpers_ -Force
            Import-Module /home/vsts/work/_tasks/PowerShell_e213ff0f-5d5c-4791-802d-52ea3e7be1f1/2.247.56/ps_modules/VstsTaskSdk -Force
            Import-Module /home/vsts/work/_tasks/PowerShell_e213ff0f-5d5c-4791-802d-52ea3e7be1f1/2.247.56/ps_modules/TlsHelper_ -Force

            $connectedServiceName = "${connectedService}"


            Write-Host "Client connected."

            # Read data from the pipe
            $reader = New-Object System.IO.StreamReader($pipe)
            while ($true) {
                Write-Host "Hey"
                $line = $reader.ReadLine()
                if ($line -eq $null) { break }
                
                $response = $line
                Write-Host "Received: $line"
                Write-Host "Sending response: $response"

                $accessToken = @{
                    token_type = $null
                    access_token = $null
                    expires_on = $null
                }

                try {
                    Write-Host "endpoint for connectedServiceName: $connectedServiceName";
                    $vstsEndpoint = Get-VstsEndpoint -Name $connectedServiceName -Require
                    Write-Host "endpoint: $endpoint";

                    $result = Get-AccessTokenMSALWithCustomScope -endpoint $vstsEndpoint -connectedServiceNameARM $connectedServiceName -scope "499b84ac-1321-427f-aa17-267ca6975798"

                    $accessToken.token_type = $result.TokenType
                    $accessToken.access_token = $result.AccessToken
                    $accessToken.expires_on = $result.ExpiresOn.ToUnixTimeSeconds()

                    Write-Host "Get-ConnectedServiceNameAccessToken: Received accessToken";
                } catch {
                    Write-Host $_
                }
                

                Write-Host $accessToken;
                
                # Send the response back to the client
                $writer = New-Object System.IO.StreamWriter($pipe)
                $writer.WriteLine($accessToken)
                $writer.Flush()
            }

            # Close the pipe
            $reader.Close()
            $pipe.Close()
    `;
    
    // Spawn the PowerShell process
    let powershell = tl.tool(tl.which('pwsh') || tl.which('powershell') || tl.which('pwsh', true));

    powershell.arg('-Command').arg(content);

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

function findPowerShellPath(): Promise<string | null> {
    return new Promise((resolve, reject) => {
        const command = 'which pwsh';

        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error(`Error finding PowerShell: ${stderr}`);
                resolve(null);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}

async function run() {
    try {
        // Get inputs.

        const connectedServiceName = tl.getInput("ConnectedServiceName", false);        
        console.log("connectedServiceName: " + connectedServiceName);
        // getAccessTokenViaWorkloadIdentityFederation(connectedServiceName);

        let pipe_name : string = "praval";
        startNamedPiped(pipe_name, connectedServiceName);


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

                $AzDoTokenPipe = New-Object System.IO.Pipes.NamedPipeClientStream(".", "${pipe_name}", [System.IO.Pipes.PipeDirection]::InOut)
                $AzDoTokenPipe.Connect(10000) # Wait up to 5 seconds for the connection
                Write-Host "Connected to the server."
                
                function Get-Token {
                    try {
                        $writer = New-Object System.IO.StreamWriter($AzDoTokenPipe)
                        $reader = New-Object System.IO.StreamReader($AzDoTokenPipe)

                        $input = "Input"

                        # Send command to the server
                        $writer.WriteLine($input)
                        $writer.Flush()

                        # Read response from the server
                        $response = $reader.ReadLine()
                        Write-Host "Server response: $response"
                        
                    }
                    catch {
                        Write-Host "Error: $_"
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
}

run();
