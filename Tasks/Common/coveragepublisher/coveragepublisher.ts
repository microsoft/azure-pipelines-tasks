
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
        // Get comprehensive proxy configuration to fix .NET HttpClient proxy issues
        const proxyConfig = getProxyEnvironmentVariables();
        
        const env = {
            "SYSTEM_ACCESSTOKEN": taskLib.getEndpointAuthorizationParameter('SystemVssConnection', 'AccessToken', false),
            "SYSTEM_TEAMFOUNDATIONCOLLECTIONURI": taskLib.getVariable('System.TeamFoundationCollectionUri'),
            "BUILD_BUILDID": taskLib.getVariable('Build.BuildId'),
            "BUILD_CONTAINERID": taskLib.getVariable('Build.ContainerId'),
            "AGENT_TEMPPATH": taskLib.getVariable('Agent.TempPath'),
            "SYSTEM_TEAMPROJECTID": taskLib.getVariable('System.TeamProjectId'),
            "PIPELINES_COVERAGEPUBLISHER_DEBUG": taskLib.getVariable('PIPELINES_COVERAGEPUBLISHER_DEBUG'),
            "DOTNET_SYSTEM_GLOBALIZATION_INVARIANT": taskLib.getVariable('DOTNET_SYSTEM_GLOBALIZATION_INVARIANT'),
            // Comprehensive proxy configuration for .NET HttpClient
            ...proxyConfig
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


function getProxyEnvironmentVariables(): { [key: string]: string } {
    const proxyVars: { [key: string]: string } = {};
    
    // Get Azure Pipelines agent proxy configuration (highest priority)
    const agentProxyUrl = taskLib.getVariable("agent.proxyurl");
    const agentProxyUsername = taskLib.getVariable("agent.proxyusername");
    const agentProxyPassword = taskLib.getVariable("agent.proxypassword");
    const agentProxyBypass = taskLib.getVariable("agent.proxybypasslist");
    
    // Input validation and sanitization
    if (agentProxyUrl && !isValidProxyUrl(agentProxyUrl)) {
        taskLib.warning("Invalid proxy URL format detected, skipping agent proxy configuration");
        return proxyVars;
    }
    
    // Construct proxy URL with authentication if available
    let proxyUrl = "";
    if (agentProxyUrl) {
        if (agentProxyUsername && agentProxyPassword) {
            // Validate credentials contain no malicious characters
            if (!isValidCredential(agentProxyUsername) || !isValidCredential(agentProxyPassword)) {
                taskLib.warning("Invalid characters detected in proxy credentials, using proxy without authentication");
                proxyUrl = agentProxyUrl;
            } else {
                // Add authentication to proxy URL
                try {
                    const url = new URL(agentProxyUrl);
                    url.username = encodeURIComponent(agentProxyUsername);
                    url.password = encodeURIComponent(agentProxyPassword);
                    proxyUrl = url.toString();
                    taskLib.debug(`Using agent proxy with authentication: ${getMaskedProxyUrl(proxyUrl)}`);
                } catch (err) {
                    proxyUrl = agentProxyUrl;
                    taskLib.warning(`Failed to parse agent proxy URL, using without authentication: ${err}`);
                }
            }
        } else {
            proxyUrl = agentProxyUrl;
            taskLib.debug(`Using agent proxy: ${getMaskedProxyUrl(agentProxyUrl)}`);
        }
    } else {
        // Fall back to environment variables
        proxyUrl = process.env['HTTPS_PROXY'] || process.env['https_proxy'] || 
                  process.env['HTTP_PROXY'] || process.env['http_proxy'] || "";
        if (proxyUrl) {
            taskLib.debug(`Using environment proxy: ${getMaskedProxyUrl(proxyUrl)}`);
        }
    }
    // Set comprehensive proxy environment variables for .NET
    if (proxyUrl) {
        // Standard proxy environment variables (case variations for compatibility)
        proxyVars["HTTP_PROXY"] = proxyUrl;
        proxyVars["HTTPS_PROXY"] = proxyUrl;
        proxyVars["http_proxy"] = proxyUrl;
        proxyVars["https_proxy"] = proxyUrl;
        
        // .NET specific environment variables to force proxy initialization
        // These are critical for resolving the HttpClient.DefaultProxy initialization issue
        proxyVars["DOTNET_SYSTEM_NET_HTTP_USEDEFAULTCREDENTIALS"] = "true";
        proxyVars["DOTNET_SYSTEM_NET_HTTP_USESOCKETSHTTPHANDLER"] = "false"; // Forces WinHttpHandler on Windows
    }
    
    // Handle NO_PROXY / bypass list
    let noProxyList = "";
    if (agentProxyBypass) {
        noProxyList = agentProxyBypass;
        taskLib.debug(`Using agent proxy bypass list: ${agentProxyBypass}`);
    } else {
        noProxyList = process.env['NO_PROXY'] || process.env['no_proxy'] || "";
        if (noProxyList) {
            taskLib.debug(`Using environment proxy bypass list: ${noProxyList}`);
        }
    }
    
    if (noProxyList) {
        proxyVars["NO_PROXY"] = noProxyList;
        proxyVars["no_proxy"] = noProxyList;
    }
    
    // Log configuration for debugging (with enhanced credential masking)
    if (proxyUrl) {
        taskLib.debug(`Proxy configuration set for .NET application: ${getMaskedProxyUrl(proxyUrl)}`);
        if (noProxyList) {
            taskLib.debug(`Proxy bypass list: ${noProxyList}`);
        }
    } else {
        taskLib.debug("No proxy configuration detected");
    }
    
    // Security note: Environment variables will contain proxy credentials
    // Ensure child process cleans up these variables after use
    return proxyVars;
}

// Security helper functions
function isValidProxyUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        return ['http:', 'https:'].includes(parsedUrl.protocol);
    } catch {
        return false;
    }
}

function isValidCredential(credential: string): boolean {
    // Basic validation to prevent injection attacks
    // Reject credentials containing potentially dangerous characters
    const dangerousChars = /[\r\n\0\x1f<>"'`\\]/;
    return !dangerousChars.test(credential) && credential.length <= 256;
}

function getMaskedProxyUrl(url: string): string {
    if (!url) return url;
    try {
        const parsedUrl = new URL(url);
        if (parsedUrl.username || parsedUrl.password) {
            // Mask both username and password for security
            return `${parsedUrl.protocol}//***: ***@${parsedUrl.host}${parsedUrl.pathname}${parsedUrl.search}`;
        }
        return url;
    } catch {
        // If URL parsing fails, mask any potential credentials pattern
        return url.replace(/\/\/[^@]*@/, '//***:***@');
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
