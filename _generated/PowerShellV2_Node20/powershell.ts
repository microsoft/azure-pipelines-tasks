import fs = require('fs');
import path = require('path');
import os = require('os');
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import { validateFileArgs } from './helpers';
import { ArgsSanitizingError } from './errors';
import { emitTelemetry } from 'azure-pipelines-tasks-utility-common/telemetry';
var uuidV4 = require('uuid/v4');
import * as msal from "@azure/msal-node";
import { getFederatedToken } from "azure-pipelines-tasks-artifacts-common/webapi";
import { spawnSync } from 'child_process';

const ts2PsPipePath = '/tmp/ts2ps';
const ps2TsPipePath = '/tmp/ps2ts';

spawnSync('mkfifo', [ts2PsPipePath]);
spawnSync('mkfifo', [ps2TsPipePath]);

spawnSync('chmod', ['600', ts2PsPipePath]);
spawnSync('chmod', ['600', ps2TsPipePath]);

process.env.System_Access_Token_PSV2_Task = tl.getVariable('System.AccessToken');

async function startNamedPiped() {
    const connectedServiceName = tl.getInput("ConnectedServiceName", false);        
    console.log("connectedServiceName: " + connectedServiceName);
    
    const pipeStream = fs.createReadStream(ps2TsPipePath);
    const writeStream = fs.createWriteStream(ts2PsPipePath);

    pipeStream.on('data', async (data) => {
        const trimmedData = data.toString('utf8').trim();
        console.log(`Received from PowerShell: ${trimmedData}`);
        var systemAccessToken = tl.getVariable('System.AccessToken');
        process.env.System_Access_Token_PSV2_Task = systemAccessToken;

        if (trimmedData == 'Get-AzDoToken') {
            try {
                if(connectedServiceName && connectedServiceName.trim().length > 0) {
                    const token = await getAccessTokenViaWorkloadIdentityFederation(connectedServiceName);
                    console.log(`Successfully fetched the ADO access token for ${connectedServiceName}`);
                    writeStream.write(token + "\n");
                } else {
                    console.log(`No Service Connection found, returning empty token`);
                    writeStream.write(systemAccessToken + "\n");
                }
            } catch(err) {
                console.log(`Token generation failed with error message ${err.message}`);
                writeStream.write(systemAccessToken + "\n");
            }
        } else {
            console.log('Pipe reading ended');
            writeStream.close();
            pipeStream.close();
            fs.unlinkSync(ts2PsPipePath);
            fs.unlinkSync(ps2TsPipePath);
        }
    });

    
    pipeStream.on('error', (err) => {
        console.error('Error with pipe stream:', err);
        writeStream.close();
        pipeStream.close();
        fs.unlinkSync(ts2PsPipePath);
        fs.unlinkSync(ps2TsPipePath);
    });
}

async function getAccessTokenViaWorkloadIdentityFederation(connectedService: string): Promise<string> {

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

async function run() {
    try {
        // Get inputs

        startNamedPiped();

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

        script = `
            # Open the FIFO for writing
            
            $pipeWriter = [System.IO.StreamWriter]::new('${ps2TsPipePath}')
            $pipeReader = [System.IO.StreamReader]::new('${ts2PsPipePath}')

            function Get-AzDoToken {
                try {
                    $pipeWriter.WriteLine('Get-AzDoToken')
                    $pipeWriter.Flush()

                    $token = $pipeReader.ReadLine()
                    $token = $token.Trim()

                    if ($null -eq $token -or $token -eq [string]::Empty) {
                        Write-Host "empty response was found, returning the System Access Token"
                        $token = $env:System_Access_Token_PSV2_Task
                    } 
                    return $token
                } 
                catch {
                    Write-Host "Error in Get-AzDoToken: $_"
                    $token = $env:System_Access_Token_PSV2_Task
                    return $token
                }
            }

            ${script}
        `;

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

        script =   `
            try { 
                ${script}
            }
            finally {
                # Close the streams
                $pipeWriter.WriteLine('Close')
                $pipeWriter.Flush()
                $pipeWriter.Close()
                $pipeReader.Close()
            }`

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
    } finally {
        const pipeStream = fs.createWriteStream(ps2TsPipePath);
        pipeStream.write('Close');
        pipeStream.close();
    }
}

run();
