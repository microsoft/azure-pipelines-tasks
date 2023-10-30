import Q = require('q');
import path = require('path');
import url = require('url');
import tl = require('azure-pipelines-task-lib/task');
import trm = require('azure-pipelines-task-lib/toolrunner');
var extend = require('util')._extend;
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common/locationUtilities";
import { logError } from 'azure-pipelines-tasks-packaging-common/util';
import {IExecSyncResult} from 'azure-pipelines-task-lib/toolrunner';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry';

interface EnvironmentDictionary { [key: string]: string; }

tl.setResourcePath(path.join( __dirname, 'task.json'));

executeTask();

async function executeTask() {
    var cwd = tl.getPathInput('cwd', true, false);
    tl.mkdirP(cwd);
    tl.cd(cwd);

    var command = tl.getInput('command', true);
    if (command.indexOf(' ') >= 0) {
        tl.setResult(tl.TaskResult.Failed, tl.loc('InvalidCommand'));
        return;
    }

    var npmRunner = tl.tool(tl.which('npm', true));
    npmRunner.arg(command);
    var args = tl.getInput('arguments', false); 
    npmRunner.line(args);

    
    if(shouldUseDeprecatedTask()) {
        
        await _logNpmStartupVariables(command, args);
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
        try{
            
            var npmrcPath: string = path.join(cwd, '.npmrc');
            var tempNpmrcPath : string = getTempNpmrcPath();
            
            var debugLog: boolean = tl.getVariable('system.debug') && tl.getVariable('system.debug').toLowerCase() === 'true';
            
            var shouldRunAuthHelper: boolean = tl.osType().toLowerCase() === 'windows_nt' && tl.exist(npmrcPath); 
            if(shouldRunAuthHelper) {
                copyUserNpmrc(tempNpmrcPath);
                await runNpmAuthHelperAsync(getNpmAuthHelperRunner(npmrcPath, tempNpmrcPath, debugLog));
            }
            
            // set required environment variables for npm execution
            var npmExecOptions = <trm.IExecOptions>{
                env: extend({}, process.env)
            };
            
            if(shouldRunAuthHelper){
                npmExecOptions.env['npm_config_userconfig'] = tempNpmrcPath;
            }
            
            if(debugLog) {
                npmExecOptions.env['npm_config_loglevel'] =  'verbose';
            }
            
            await _logNpmStartupVariables(command, args, npmrcPath, debugLog, shouldRunAuthHelper);

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
        var execOptions = <trm.IExecOptions>{
            env: extend({}, process.env)
        };
        execOptions.env = await addBuildCredProviderEnv(execOptions.env);

        var code : number = await npmAuthRunner.exec(execOptions);
        tl.debug('Auth helper exitted with code: ' + code);
        return Q(code);
    } catch (err) {
        // warn on any auth failure and try to run the task.
        tl.warning(tl.loc('NpmAuthFailed', err.message));
    }
}

function copyUserNpmrc(tempNpmrcPath: string) {
    // copy the user level npmrc contents, if it exists.
    var currentUserNpmrcPath : string = getUserNpmrcPath();
    if(tl.exist(currentUserNpmrcPath)) {
        tl.debug(`Copying ${currentUserNpmrcPath} to ${tempNpmrcPath} ...`);
        tl.cp(currentUserNpmrcPath, tempNpmrcPath, /* options */ null, /* continueOnError */ true);
    }
}

function getUserNpmrcPath() {
    var userNpmRc = process.env['npm_config_userconfig'];
    if(!userNpmRc){
        // default npm rc is located at user's home folder.
        userNpmRc = path.join(process.env['USERPROFILE'], '.npmrc');
    }
    tl.debug(`User npm rc: ${userNpmRc}`);
    return userNpmRc;
}

async function tryRunNpmConfigAsync(npmConfigRunner: trm.ToolRunner, execOptions : trm.IExecOptions) {
    try {
        var code = await npmConfigRunner.exec(execOptions);
    } catch (err) {
        // 'npm config list' comamnd is run only for debugging/diagnostic
        // purposes only. Failure of this shouldn't be fatal.
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
    return tl.getVariable('USE_DEPRECATED_TASK_VERSION') && tl.getVariable('USE_DEPRECATED_TASK_VERSION').toLowerCase() === 'true';
}

function getNpmAuthHelperRunner(npmrcPath: string, tempUserNpmrcPath: string, includeDebugLogs: boolean): trm.ToolRunner {
    let npmAuthHelper = tl.tool(getNpmAuthHelperPath());
    let verbosityString = includeDebugLogs ? 'Detailed' : 'Normal';
    npmAuthHelper.line(`-NonInteractive -Verbosity ${verbosityString} -Config "${npmrcPath}" -TargetConfig "${tempUserNpmrcPath}"`);
    return npmAuthHelper;
}

function getNpmAuthHelperPath(): string {
    let authHelperExternalPath = path.join(__dirname, 'Npm', 'vsts-npm-auth');
    let allFiles = tl.find(authHelperExternalPath);
    var matchingFiles = allFiles.filter(tl.filter('vsts-npm-auth.exe', {nocase: true, matchBase: true}));

    if (matchingFiles.length !== 1) {
        // Let the framework produce the desired error message
        tl.checkPath(path.join(authHelperExternalPath, "bin", "vsts-npm-auth.exe"), 'vsts-npm-auth');
    }

    return matchingFiles[0];
}

function getNpmConfigRunner(includeDebugLogs: boolean): trm.ToolRunner {
    var npmConfig = tl.tool(tl.which('npm', true));
    npmConfig.line('config list');
    if(includeDebugLogs) {
        npmConfig.arg('-l');
    }
    return npmConfig;
}

function getTempNpmrcPath() : string {
    var tempNpmrcDir
        = tl.getVariable('Agent.BuildDirectory')
        || tl.getVariable('Agent.TempDirectory');
    tempNpmrcDir = path.join(tempNpmrcDir, 'npm');
    tl.mkdirP(tempNpmrcDir);
    var tempUserNpmrcPath: string = path.join(tempNpmrcDir, 'auth.' + tl.getVariable('build.buildId') + '.npmrc');
    return tempUserNpmrcPath;
}

function cleanUpTempNpmrcPath(tempUserNpmrcPath: string) {
    tl.debug('cleaning up...')
    if(tl.exist(tempUserNpmrcPath)) {
        tl.debug(`deleting temporary npmrc at '${tempUserNpmrcPath}'` );
        tl.rmRF(tempUserNpmrcPath);
    }
}

async function addBuildCredProviderEnv(env: EnvironmentDictionary) : Promise<EnvironmentDictionary> {

    var credProviderPath : string = path.join(__dirname, 'Npm/CredentialProvider');

    // get build access token
    var accessToken : string = pkgLocationUtils.getSystemAccessToken();

    // get uri prefixes
    var serviceUri : string = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
    let packagingLocation: pkgLocationUtils.PackagingLocation;
    try {
        packagingLocation = await pkgLocationUtils.getPackagingUris(pkgLocationUtils.ProtocolType.Npm);
    } catch (error) {
        tl.debug("Unable to get packaging URIs");
        logError(error);
        throw error;
    }

    var urlPrefixes : string[] = packagingLocation.PackagingUris;
    tl.debug(`discovered URL prefixes: ${urlPrefixes}`);

    // Note to readers: This variable will be going away once we have a fix for the location service for
    // customers behind proxies
    let testPrefixes = tl.getVariable("NpmTasks.ExtraUrlPrefixesForTesting");
    if (testPrefixes) {
        urlPrefixes = urlPrefixes.concat(testPrefixes.split(";"));
        tl.debug(`all URL prefixes: ${urlPrefixes}`);
    }

    // These env variables are using NUGET because the credential provider that is being used
    // was built only when NuGet was supported. It is basically using environment variable to
    // pull out the access token, hence can be used in Npm scenario as well.
    env['VSS_NUGET_ACCESSTOKEN'] = accessToken;
    env['VSS_NUGET_URI_PREFIXES'] = urlPrefixes.join(';');
    env['NPM_CREDENTIALPROVIDERS_PATH'] =  credProviderPath;
    env['VSS_DISABLE_DEFAULTCREDENTIALPROVIDER'] = '1';
    return env;
}

async function _logNpmStartupVariables(command: string, args?: string, npmrcPath?: string, debugLog?: boolean, shouldRunAuthHelper?: boolean) {
    try {
        // Log the NPM version
        let version: string;
        try {
            const syncResult: IExecSyncResult = tl.execSync('npm', '--version');
            if (syncResult.stdout) {
                version = syncResult.stdout.trim();
            }
        } catch (err) {
            tl.debug(`Unable to get NPM config info. Err:( ${err} )`);
        }

        const npmTelem = {
            'command': command,
            'arguments': args || null,
            'USE_DEPRECATED_TASK_VERSION': tl.getVariable('USE_DEPRECATED_TASK_VERSION'),
            'npmrcPath': npmrcPath || null,
            'debugLog': debugLog || null,
            'npmVersion': version,
        };

        telemetry.emitTelemetry('Packaging', 'npm', npmTelem);
    } catch (err) {
        tl.debug(`Unable to log NPM task telemetry. Err:( ${err} )`);
    }
}