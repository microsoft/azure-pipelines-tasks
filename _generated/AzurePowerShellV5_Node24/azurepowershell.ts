import fs = require('fs');
import path = require('path');
import os = require('os');
import tl = require('azure-pipelines-task-lib/task');
import tr = require('azure-pipelines-task-lib/toolrunner');
import { validateAzModuleVersion } from "azure-pipelines-tasks-azure-arm-rest/azCliUtility";

import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-endpoint';
var uuidV4 = require('uuid/v4');

function convertToNullIfUndefined<T>(arg: T): T|null {
    return arg ? arg : null;
}

async function run() {
    let resolvedPwshPath: string = '';
    let input_workingDirectory = tl.getPathInput('workingDirectory', /*required*/ true, /*check*/ true);
    let tempDirectory = tl.getVariable('agent.tempDirectory');
    tl.checkPath(tempDirectory, `${tempDirectory} (agent.tempDirectory)`);

    const env = process.env;
    const hostEnv = `ADO/AzurePowerShell@v5_${env.AGENT_OS || ""}_${env.AGENT_NAME || ""}_${env.BUILD_DEFINITIONNAME || ""}_${env.BUILD_BUILDID || ""}_${env.RELEASE_DEFINITIONNAME || ""}_${env.RELEASE_RELEASEID || ""}`;

    process.env.AZUREPS_HOST_ENVIRONMENT = hostEnv;
    console.log(`AZUREPS_HOST_ENVIRONMENT: ${hostEnv}`);

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        // Get inputs.
        let _vsts_input_errorActionPreference: string = tl.getInput('errorActionPreference', false) || 'Stop';
        switch (_vsts_input_errorActionPreference.toUpperCase()) {
            case 'STOP':
            case 'CONTINUE':
            case 'SILENTLYCONTINUE':
                break;
            default:
                throw new Error(tl.loc('JS_InvalidErrorActionPreference', _vsts_input_errorActionPreference));
        }

        let scriptType: string = tl.getInput('ScriptType', /*required*/true);
        let scriptPath = convertToNullIfUndefined(tl.getPathInput('ScriptPath', false));
        let scriptInline: string = convertToNullIfUndefined(tl.getInput('Inline', false));
        let scriptArguments: string = convertToNullIfUndefined(tl.getInput('ScriptArguments', false));
        let _vsts_input_failOnStandardError = convertToNullIfUndefined(tl.getBoolInput('FailOnStandardError', false));
        let targetAzurePs: string = convertToNullIfUndefined(tl.getInput('TargetAzurePs', false));
        let customTargetAzurePs: string = convertToNullIfUndefined(tl.getInput('CustomTargetAzurePs', false));
        let serviceName = tl.getInput('ConnectedServiceNameARM',/*required*/true);
        let endpointObject= await new AzureRMEndpoint(serviceName).getEndpoint();
        let isDebugEnabled = (process.env['SYSTEM_DEBUG'] || "").toLowerCase() === "true";

        // string constants
        const otherVersion = "OtherVersion"
        const fetchingModule = "azure-powershell"
        const moduleDisplayName = "Az module"
        const majorversionTolerance = 3

        if (targetAzurePs == otherVersion) {
            if (customTargetAzurePs != "") {
                targetAzurePs = customTargetAzurePs;
                await validateAzModuleVersion(fetchingModule, customTargetAzurePs, moduleDisplayName, majorversionTolerance, true)
            }
            else {
                console.log(tl.loc('InvalidAzurePsVersion',customTargetAzurePs));
            }
        }
        else {
            targetAzurePs = ""
             if (tl.getPipelineFeature('ShowWarningOnOlderAzureModules')) {
                const azVersionResult = await getInstalledAzModuleVersion();
                if (azVersionResult) {
                    await validateAzModuleVersion(fetchingModule, azVersionResult, moduleDisplayName, majorversionTolerance, true)
                }
             }
        }

        var endpoint = JSON.stringify(endpointObject).replace(/'/g, "''");

        if (scriptType.toUpperCase() == 'FILEPATH') {
            if (!tl.stats(scriptPath).isFile() || !scriptPath.toUpperCase().match(/\.PS1$/)) {
                throw new Error(tl.loc('JS_InvalidFilePath', scriptPath));
            }
        }

        // Generate the script contents.
        console.log(tl.loc('GeneratingScript'));
        let contents: string[] = [];

        if (isDebugEnabled) {
            contents.push("$VerbosePreference = 'continue'");
        }

        const makeModuleAvailableScriptPath = path.join(path.resolve(__dirname), 'TryMakingModuleAvailable.ps1');
        contents.push(`${makeModuleAvailableScriptPath} -targetVersion '${targetAzurePs}' -platform Linux`);

        contents.push(`$ErrorActionPreference = '${_vsts_input_errorActionPreference}'`);

        let azFilePath = path.join(path.resolve(__dirname), 'InitializeAz.ps1');
        let initAzCommand = `${azFilePath} -endpoint '${endpoint}'`
        if (targetAzurePs != "") {
            initAzCommand += ` -targetAzurePs  ${targetAzurePs}`;
        }
        if (endpointObject.scheme === 'WorkloadIdentityFederation') {
            const oidc_token = await endpointObject.applicationTokenCredentials.getFederatedToken();
            initAzCommand += ` -clientAssertionJwt ${oidc_token} -serviceConnectionId ${serviceName}`;
        }
        contents.push(initAzCommand);

        if (scriptArguments == null) {
            scriptArguments = "";
        }

        if (scriptType.toUpperCase() == 'FILEPATH') {
            contents.push(`. '${scriptPath.replace(/'/g, "''")}' ${scriptArguments}`.trim());
            console.log(tl.loc('JS_FormattedCommand', contents[contents.length - 1]));
        }
        else {
            contents.push(scriptInline);
        }

        // Write the script to disk.
        tl.assertAgent('2.115.0');
        let filePath = path.join(tempDirectory, uuidV4() + '.ps1');

        await fs.writeFile(
            filePath,
            '\ufeff' + contents.join(os.EOL), // Prepend the Unicode BOM character.
            { encoding: 'utf8' }, // Since UTF8 encoding is specified, node will
                                          // encode the BOM into its UTF8 binary sequence.
            function (err) {
                if (err) throw err;
                console.log('File saved!');
            });

        // Run the script.
        //
        // Note, prefer "pwsh" over "powershell". At some point we can remove support for "powershell".
        //
        // Note, use "-Command" instead of "-File" to match the Windows implementation. Refer to
        // comment on Windows implementation for an explanation why "-Command" is preferred.
        const importSdk = path.join(path.resolve(__dirname), 'ImportVstsTaskSdk.ps1');
        resolvedPwshPath = tl.which('pwsh') || tl.which('powershell') || tl.which('pwsh', true);
        let powershell = tl.tool(resolvedPwshPath)
            .arg('-NoLogo')
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-ExecutionPolicy')
            .arg('Unrestricted')
            .arg('-Command')
            .arg(`. '${importSdk}'; . '${filePath.replace(/'/g, "''")}'`);

        let options = <tr.IExecOptions>{
            cwd: input_workingDirectory,
            failOnStdErr: false,
            errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
            outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
            ignoreReturnCode: true
        };

        // Listen for stderr.
        let stderrFailure = false;
        if (_vsts_input_failOnStandardError) {
            powershell.on('stderr', (data) => {
                stderrFailure = true;
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
        }
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message || 'run() failed');
    }
    finally {
        // Cleanup is best-effort and must NOT override the task's actual result.
        // This matches the Windows handler (azurepowershell.ps1), which has long used
        // `Disconnect-AzureAndClearContext -ErrorAction SilentlyContinue`.
        let cleanupExitCode = 0;
        let cleanupOutcome: 'Success' | 'NonZeroExit' | 'Threw' | 'SkippedPwshNotResolved' = 'Success';
        let cleanupErrorMessage: string | undefined;
        try {
            if (!resolvedPwshPath) {
                tl.debug("Skipping cleanup: PowerShell executable was not resolved during main execution.");
                cleanupOutcome = 'SkippedPwshNotResolved';
            } else {
                const powershell = tl.tool(resolvedPwshPath)
                    .arg('-NoLogo')
                    .arg('-NoProfile')
                    .arg('-NonInteractive')
                    .arg('-ExecutionPolicy')
                    .arg('Unrestricted')
                    .arg('-Command')
                    .arg(`. '${path.join(path.resolve(__dirname), 'RemoveAzContext.ps1')}'`);

                let options = <tr.IExecOptions>{
                    cwd: input_workingDirectory,
                    failOnStdErr: false,
                    errStream: process.stdout, // Direct all output to STDOUT, otherwise the output may appear out
                    outStream: process.stdout, // of order since Node buffers it's own STDOUT but not STDERR.
                    ignoreReturnCode: true
                };
                cleanupExitCode = await powershell.exec(options);
                tl.debug(`Cleanup exit code: ${cleanupExitCode}`);

                if (cleanupExitCode !== 0) {
                    cleanupOutcome = 'NonZeroExit';
                    tl.warning(`Azure context cleanup completed with exit code: ${cleanupExitCode}. Azure context may not have been fully cleared.`);
                }
            }
        }
        catch (err) {
            cleanupOutcome = 'Threw';
            cleanupErrorMessage = err && err.message ? err.message : String(err);
            tl.warning(`Azure context cleanup failed: ${cleanupErrorMessage}. Azure context may not have been fully cleared.`);
        }

        // Best-effort: clear service connection env vars from the agent process
        // even if the PowerShell cleanup script failed.
        if (cleanupExitCode !== 0 || !resolvedPwshPath) {
            tl.debug("Clearing service connection environment variables from agent process.");
            delete process.env.AZURESUBSCRIPTION_SERVICE_CONNECTION_ID;
            delete process.env.AZURESUBSCRIPTION_CLIENT_ID;
            delete process.env.AZURESUBSCRIPTION_TENANT_ID;
        }

        // Emit CustomerIntelligence so the Kusto monitor can track cleanup outcomes
        // across the new code path. Best-effort — never throws.
        emitCleanupTelemetry(cleanupOutcome, cleanupExitCode, cleanupErrorMessage);
    }
}

function emitCleanupTelemetry(
    outcome: 'Success' | 'NonZeroExit' | 'Threw' | 'SkippedPwshNotResolved',
    exitCode: number,
    errorMessage: string | undefined
): void {
    try {
        const payload = {
            Outcome: outcome,
            ExitCode: exitCode,
            // First 200 chars of the error message only — error text is not sensitive but bound it
            // defensively so a stack trace cannot blow up the telemetry record.
            ErrorMessageShort: errorMessage ? errorMessage.substring(0, 200) : undefined,
            AgentOS: process.env.AGENT_OS,
            AgentVersion: process.env.AGENT_VERSION,
            TaskVersion: '5'
        };
        console.log("##vso[telemetry.publish area=%s;feature=%s]%s",
            'TaskHub',
            'AzurePowerShellV5_Cleanup',
            JSON.stringify(payload));
    } catch (err) {
        // Telemetry must never fail the task.
        tl.debug(`Unable to publish cleanup telemetry: ${err && err.message ? err.message : err}`);
    }
}

async function getInstalledAzModuleVersion(): Promise<string | null> {
    try {
        tl.debug('Checking installed Az PowerShell module version...');

        // PowerShell command to get the installed Az module version
        const powershell = tl.tool(tl.which('pwsh') || tl.which('powershell') || tl.which('pwsh', true))
            .arg('-NoLogo')
            .arg('-NoProfile')
            .arg('-NonInteractive')
            .arg('-ExecutionPolicy')
            .arg('Unrestricted')
            .arg('-Command')
            .arg(`. '${path.join(path.resolve(__dirname),'Utility.ps1')}'; Get-InstalledMajorRelease -moduleName 'Az' -iswin $false`);

        const result = await powershell.execSync()
        if (result.code === 0 && result.stdout) {
            const version = result.stdout.trim();
            if (version && version !== '' && version !== '0.0.0') {
                tl.debug(`Found installed Az module version: ${version}`);
                return version;
            }
        }
        tl.debug('Az PowerShell module not found on the agent');
        return null;
    } catch (error) {
        tl.debug(`Error checking installed Az module version: ${error.message}`);
        return null;
    }
}

run();
