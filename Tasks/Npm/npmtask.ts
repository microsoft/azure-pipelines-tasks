import Q = require('q');
import fs = require('fs');
import path = require('path');
import url = require('url');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

interface EnvironmentDictionary { [key: string]: string; }

tl.setResourcePath(path.join( __dirname, 'task.json'));

executeTask();

async function executeTask() {

    var cwd = tl.getPathInput('cwd', true, false);
    tl.mkdirP(cwd);
    tl.cd(cwd);

    var command = tl.getInput('command', true);
    if (command.indexOf(' ') >= 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc("InvalidCommand"));
    }

    var npmRunner = tl.createToolRunner(tl.which('npm', true));
    npmRunner.arg(command);
    npmRunner.argString(tl.getInput('arguments', false));


    if(shouldUseDeprecatedTask()) {

        // deprecated version of task, which just runs the npm command with NO auth support.
        try{
            var code : number = await npmRunner.exec();
            tl.setResult(code, tl.loc('NpmReturnCode', code));
        } catch (err) {
            tl.debug('taskRunner fail');
            tl.setResult(tl.TaskResult.Failed, tl.loc('NpmFailed', err.message));
        }
    } else {

        // new task version with auth support
        var npmrcPath: string = path.join(cwd, '.npmrc');
        var tempNpmrcPath : string = getTempNpmrcPath();
        var debugLog: boolean = true;
        if (tl.getVariable('system.debug') != undefined && tl.getVariable('system.debug').toLowerCase() === 'false') {
            debugLog = false;
        }

        try{
            await runNpmAuthHelperAsync(getNpmAuthHelperRunner(npmrcPath, tempNpmrcPath, debugLog));

            // set required environment variables for npm execution
            var npmExecOptions: trm.IExecOptions = {};
            npmExecOptions.env = process.env;
            npmExecOptions.env['npm_config_userconfig'] = tempNpmrcPath;
            if(debugLog) {
                npmExecOptions.env['npm_config_loglevel'] =  'verbose';
            }

            await tryRunNpmConfigAsync(getNpmConfigRunner(debugLog), npmExecOptions);
            var code : number =  await runNpmCommandAsync(npmRunner, npmExecOptions);
            cleanUpTempNpmrcPath(tempNpmrcPath);
            tl.setResult(code, tl.loc('NpmReturnCode', code));
        } catch (err) {
            cleanUpTempNpmrcPath(tempNpmrcPath);
            tl.setResult(tl.TaskResult.Failed, tl.loc('NpmFailed', err.message));
        }
    }
}

async function runNpmAuthHelperAsync(npmAuthRunner: trm.ToolRunner) : Promise<number> {
    try{
        var execOptions : trm.IExecOptions = {};
        execOptions.env = process.env || getBuildCredProviderEnv();
        var code : number = await npmAuthRunner.exec(execOptions);
        tl.debug('Authentication succeeded with code: ' + code);
        return Q(code);
    } catch (err) {
        tl.debug(tl.loc('NpmAuthFailed', err.message));
        throw err;
    }
}

async function tryRunNpmConfigAsync(npmConfigRunner: trm.ToolRunner, execOptions : trm.IExecOptions) {
    try {
        var code = await npmConfigRunner.exec(execOptions);
    } catch (err) {
        // do not throw on this failure.
        tl.warning(tl.loc('NpmConfigFailed', err.Message));
    }
}

async function runNpmCommandAsync(npmCommandRunner: trm.ToolRunner, execOptions : trm.IExecOptions) : Promise<number> {
    try{
        var code: number = await npmCommandRunner.exec(execOptions);
        tl.debug('Npm command succeeded with code: ' + code);
        return Q(code);
    } catch (err) {
        tl.debug(tl.loc('NpmFailed', err.message));
        throw err;
    }
}

function shouldUseDeprecatedTask() : boolean {
    return tl.getVariable('USE_DEPRECATED_TASK_VERSION') != undefined && tl.getVariable('USE_DEPRECATED_TASK_VERSION').toLowerCase() === 'true';
}

function getNpmAuthHelperRunner(npmrcPath: string, tempUserNpmrcPath: string, includeDebugLogs: boolean): trm.ToolRunner {
    var npmAuthHelper = tl.createToolRunner(path.join(__dirname, 'Npm/vsts-npm-auth/bin/vsts-npm-auth.exe'));
    var verbosityString = includeDebugLogs ? 'Detailed' : 'Normal';
    npmAuthHelper.argString(`-NonInteractive -Verbosity ${verbosityString} -Config "${npmrcPath}" -TargetConfig "${tempUserNpmrcPath}"`);
    return npmAuthHelper;
}

function getNpmConfigRunner(includeDebugLogs: boolean): trm.ToolRunner {
    var npmConfig = tl.createToolRunner(tl.which('npm', true));
    npmConfig.argString('config list');
    if(includeDebugLogs) {
        npmConfig.arg('-l');
    }
    return npmConfig;
}

function getTempNpmrcPath() : string {
    var tempNpmrcDir
        = tl.getVariable('Agent.BuildDirectory')
        || tl.getVariable('Agent.ReleaseDirectory')
        || process.cwd();
    tempNpmrcDir = path.join(tempNpmrcDir, 'npm');
    tl.mkdirP(tempNpmrcDir);
    var tempUserNpmrcPath: string = path.join(tempNpmrcDir, 'auth.' + tl.getVariable('build.buildId') + '.npmrc');
    return tempUserNpmrcPath;
}

function cleanUpTempNpmrcPath(tempUserNpmrcPath: string) {
    tl.debug('cleaning up...')
    if(tl.exist(tempUserNpmrcPath)) {
        tl.debug(`deleting temporary npmrc at '${tempUserNpmrcPath}'` );
        tl.rmRF(tempUserNpmrcPath, /* continueOnError */ false);
    }
}

function getBuildCredProviderEnv() : EnvironmentDictionary {

	var env : EnvironmentDictionary = {};
    let credProviderPath : string = path.join(__dirname, 'Npm/CredentialProvider');
	
    // get build access token
	var accessToken : string = getSystemAccessToken();

    // get uri prefixes
    var serviceUri : string = tl.getEndpointUrl("SYSTEMVSSCONNECTION", false);
    var urlPrefixes : string[] = assumeNpmUriPrefixes(serviceUri);
	tl.debug(`discovered URL prefixes: ${urlPrefixes}`);
	
    //TODO these env variables should NOT use NUGET...
	env["VSS_NUGET_ACCESSTOKEN"] = accessToken;
	env["VSS_NUGET_URI_PREFIXES"] = urlPrefixes.join(";");
	env["NPM_CREDENTIALPROVIDERS_PATH"] =  credProviderPath;
    return env;
}

function getSystemAccessToken(): string {
    tl.debug("Getting credentials for local feeds");
    let auth = tl.getEndpointAuthorization("SYSTEMVSSCONNECTION", false);
    if (auth.scheme === "OAuth") {
        tl.debug("Got auth token");
        return auth.parameters["AccessToken"];
    } else {
        tl.warning(tl.loc("BuildCredentialsWarn"));
    }
}

function assumeNpmUriPrefixes(collectionUri: string): string[] {
    let prefixes = [collectionUri];

    let collectionUrlObject = url.parse(collectionUri);
    if(collectionUrlObject.hostname.toUpperCase().endsWith(".VISUALSTUDIO.COM"))
    {
        let hostparts = collectionUrlObject.hostname.split(".");
        let packagingHostName = hostparts[0] + ".pkgs.visualstudio.com";
        collectionUrlObject.hostname = packagingHostName;
        // remove the host property so it doesn't override the hostname property for url.format
        delete collectionUrlObject.host;
        prefixes.push(url.format(collectionUrlObject));
    }

    return prefixes;
}