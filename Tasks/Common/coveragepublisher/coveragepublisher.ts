
import * as toolRunner from 'azure-pipelines-task-lib/toolrunner';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as UUID from 'uuid/v4';
import {execSync} from 'child_process';

export async function PublishCodeCoverage(inputFiles: string[], sourceDirectory?: string) {
    var reportDirectory = path.join(getTempFolder(), UUID());
    fs.mkdirSync(reportDirectory);
    publishCoverage(inputFiles, reportDirectory, sourceDirectory)
}

async function publishCoverage(inputFiles: string[], reportDirectory: string, pathToSources?: string) {

    if(!inputFiles || inputFiles.length == 0) {
        taskLib.setResult(taskLib.TaskResult.Failed, taskLib.loc("NoInputFiles"));
        return;
    }

    const osvar = process.platform;
    let dotnet: toolRunner.ToolRunner;

    const dotnetPath = taskLib.which('dotnet', false);
    if (!dotnetPath && osvar !== 'win32') {
        taskLib.warning(taskLib.loc('InstallDotNetCoreForPublishing'));
        return false;
    }

    if (osvar === 'win32') {
        // use full .NET to execute
        dotnet = taskLib.tool(path.join(__dirname, 'CoveragePublisher', 'CoveragePublisher.Console.exe'));
    } 
    else if(osvar==='linux')
    {
         // use full .NET to execute
        var filepath=path.join(__dirname, 'CoveragePublisher','linux-x64', 'CoveragePublisher.Console');
        execSync('chmod +x '+filepath);
        dotnet=taskLib.tool(filepath);
    }
    else if(osvar==='darwin')
    {
         // use full .NET to execute
        var filepath=path.join(__dirname, 'CoveragePublisher', 'osx-x64', 'CoveragePublisher.Console');
        execSync('chmod +x '+filepath);
        dotnet=taskLib.tool(filepath);
    }
    else{
        dotnet = taskLib.tool(dotnetPath);
        dotnet.arg(path.join(__dirname, "CoveragePublisher", 'CoveragePublisher.Console.dll'));
    }

    for (const inputFile of inputFiles) {
        dotnet.arg(inputFile);
    }
    dotnet.arg('--reportDirectory');
    dotnet.arg(reportDirectory);

    if(!isNullOrWhitespace(pathToSources)) {
        dotnet.arg('--sourceDirectory');
        dotnet.arg(pathToSources);
    }

    try {
        const env = {
            "SYSTEM_ACCESSTOKEN": taskLib.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false),
            "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI": taskLib.getVariable('System.TeamFoundationCollectionUri'),
            "BUILD_BUILDID": taskLib.getVariable('Build.BuildId'),
            "BUILD_CONTAINERID": taskLib.getVariable('Build.ContainerId'),
            "AGENT_TEMPPATH": taskLib.getVariable('Agent.TempPath'),
            "SYSTEM_TEAMPROJECTID": taskLib.getVariable('System.TeamProjectId'),
            "PIPELINES_COVERAGEPUBLISHER_DEBUG": taskLib.getVariable('PIPELINES_COVERAGEPUBLISHER_DEBUG'),
            "HTTPS_PROXY": process.env['HTTPS_PROXY'],
            "NO_PROXY": process.env['NO_PROXY'],
            "DOTNET_SYSTEM_GLOBALIZATION_INVARIANT": taskLib.getVariable('DOTNET_SYSTEM_GLOBALIZATION_INVARIANT'),
            // NTLM proxy support
            "NTLM_PROXY": process.env['NTLM_PROXY'] || taskLib.getVariable('NTLM_PROXY'),
            "NTLM_USERNAME": process.env['NTLM_USERNAME'] || taskLib.getVariable('NTLM_USERNAME'),
            "NTLM_PASSWORD": process.env['NTLM_PASSWORD'] || taskLib.getVariable('NTLM_PASSWORD'),
            "NTLM_DOMAIN": process.env['NTLM_DOMAIN'] || taskLib.getVariable('NTLM_DOMAIN'),
            "HTTP_PROXY": process.env['HTTP_PROXY'],
            // SSL/TLS configuration for NTLM proxy
            "DOTNET_SYSTEM_NET_HTTP_USESOCKETSHTTPHANDLER": "0", // Use WinHttpHandler on Windows for better proxy support
            "DOTNET_SYSTEM_NET_HTTP_USEWINHTTP": "true", // Force WinHTTP on Windows
            "DOTNET_SYSTEM_NET_DISABLEIPV6": process.env['DOTNET_SYSTEM_NET_DISABLEIPV6'] || "false",
            // SSL certificate validation options for problematic proxies
            "DOTNET_SYSTEM_NET_HTTP_SOCKETSHTTPHANDLER_HTTP2SUPPORT": "false", // Disable HTTP/2 if causing issues
            // Additional proxy bypass options
            "PROXY_BYPASS_ON_LOCAL": process.env['PROXY_BYPASS_ON_LOCAL'] || taskLib.getVariable('PROXY_BYPASS_ON_LOCAL'),
            // Trust proxy certificates if needed (use with caution)
            "ACCEPT_INVALID_SSL_CERTS": process.env['ACCEPT_INVALID_SSL_CERTS'] || taskLib.getVariable('ACCEPT_INVALID_SSL_CERTS')
        };

        await dotnet.exec({
            env,
            ignoreReturnCode: false,
            failOnStdErr: true,
            windowsVerbatimArguments: true,
            errStream: {
                write: (data: Buffer) => {
                    console.error(data.toString());
                    taskLib.setResult(taskLib.TaskResult.Failed, undefined);
                }
            },
        } as any);

    } catch (err) {
        // Logging should be handled thorugh error stream
    }
}


function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input == null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

function getTempFolder(): string {
    try {
        taskLib.assertAgent('2.115.0');
        const tmpDir = taskLib.getVariable('Agent.TempDirectory');
        return tmpDir;
    } catch (err) {
        taskLib.warning(taskLib.loc('UpgradeAgentMessage'));
        return os.tmpdir();
    }
}
