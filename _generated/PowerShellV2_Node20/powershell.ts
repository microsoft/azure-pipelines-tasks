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
import cp = require('child_process');

const taskToUserScriptPipePath = '/tmp/ts2us' + uuidV4();
const userScriptToTaskPipePath = '/tmp/us2ts' + uuidV4();

/*
    This method is responsible for serving the access token requests from user script received via Get-AzDoToken method
    - The pipestream would keep listening to the 'Get-AzDoToken' requests
        - For each request, it would generate the access token for the input ADO service connection and write it to the taskToUserScriptPipe
        - If any exception is occurred during token generation, it would be written to the pipe with prefix "exception:"
    - It terminates once any request other than 'Get-AzDoToken' comes it to.   
*/
async function tokenHandler(connectedServiceName : string) {
    const pipeStream = fs.createReadStream(userScriptToTaskPipePath);
    const writeStream = fs.createWriteStream(taskToUserScriptPipePath);

    pipeStream.on('data', async (data) => {
        const command = data.toString('utf8').trim();
        tl.debug(`Received from PowerShell: ${command}`);

        if (command == 'Get-AzDoToken') {
            try {
                const token = await getAccessTokenViaWorkloadIdentityFederation(connectedServiceName);
                tl.debug(`Successfully fetched the ADO access token for ${connectedServiceName}`);
                writeStream.write(token + "\n");
            } catch(err) {
                tl.debug(`Token generation failed with error message ${err.message}`);
                writeStream.write("exception: " + err.message + "\n");
            }
        } else {
            try {
                tl.debug('Pipe reading ended');
                writeStream.close();
                pipeStream.close();
                fs.unlinkSync(taskToUserScriptPipePath);
                fs.unlinkSync(userScriptToTaskPipePath);
            } catch(err) {
                tl.debug(`Cleanup failed : ${err.message}`);
            } 
        }
    });

    pipeStream.on('error', (err) => {
        try {
            tl.debug('Error with pipe stream:' + err);
            writeStream.close();
            pipeStream.close();
            fs.unlinkSync(taskToUserScriptPipePath);
            fs.unlinkSync(userScriptToTaskPipePath);
        }
        catch(err) {
            tl.debug(`Cleanup failed : ${err.message}`);
        }
    });
}

async function getAccessTokenViaWorkloadIdentityFederation(connectedService: string): Promise<string> {
  const authorizationScheme = tl
    .getEndpointAuthorizationSchemeRequired(connectedService)
    .toLowerCase();

  if (authorizationScheme !== "workloadidentityfederation") {
    throw new Error(`Authorization scheme ${authorizationScheme} is not supported.`);
  }

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

    if(result?.expiresOn) {
        const minutes = (result.expiresOn.getTime() - new Date().getTime())/60000;
        console.log(`Generated access token with expiration time of ${minutes} minutes.`);
    }
    
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

    const connectedServiceName = tl.getInput("ConnectedServiceName", false);
    const systemAccessToken = tl.getVariable('System.AccessToken');

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Only run the token handler logic if an ADO Service connection is provided as an input.
        if(connectedServiceName && connectedServiceName.trim().length > 0)
        {
            // FIFO pipes for comm between the Task and User Script for Service connection Access token
            cp.spawnSync('mkfifo', [taskToUserScriptPipePath]);
            cp.spawnSync('mkfifo', [userScriptToTaskPipePath]);

            cp.spawnSync('chmod', ['600', taskToUserScriptPipePath]);
            cp.spawnSync('chmod', ['600', userScriptToTaskPipePath]);

            tokenHandler(connectedServiceName);
        }
        
        // Get inputs
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
                Invoke-Command {${script}} -WarningVariable +warnings;
            `;
        }

        /*
            Adding a utility called Get-AzDoToken
            - when an ADO Service connection is provided as an input, this function would return an access token for the same.
                - To get the access token, user script will call this method,
                - this method would write the request to the $us2tsPipeWriter pipe,
                - the async TokenHandler(above) running as part of task script will read this request,
                - after reading the request, it will generate the token and write it to the ts2usPipeReader pipe,
                - if there were any errors/exception in generate the token, the exception message will be written starting with "exception:"
                - this method will read the response from the TokenHandler and if not an exception message, return the token,
                - otherwise throw an exception was the message.  
            - If no ADO service connection is provided, this function returns the System.AccessToken. 
        */
        if(connectedServiceName && connectedServiceName.trim().length > 0) {
            script = `
                $us2tsPipeWriter = $null
                $ts2usPipeReader = $null

                try {
                    $us2tsPipeWriter = [System.IO.StreamWriter]::new('${userScriptToTaskPipePath}');
                    $ts2usPipeReader = [System.IO.StreamReader]::new('${taskToUserScriptPipePath}');

                    function Get-AzDoToken {
                        $us2tsPipeWriter.WriteLine('Get-AzDoToken');
                        $us2tsPipeWriter.Flush();

                        $response = $ts2usPipeReader.ReadLine();
                        $response = $response.Trim();

                        if ($response.StartsWith("exception:")) {
                            throw $response
                        } 

                        return $response;
                    }

                    ${script}
                } finally {
                    if($us2tsPipeWriter) {
                        $us2tsPipeWriter.WriteLine('Close');
                        $us2tsPipeWriter.Flush();
                        $us2tsPipeWriter.Close();
                    } 
                    if($ts2usPipeReader) {
                        $ts2usPipeReader.Close();
                    }
                }
            `;
        } else {
            script = `
                function Get-AzDoToken {
                    return "${systemAccessToken}"
                }
                
                ${script}
            `;
        }
        
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
