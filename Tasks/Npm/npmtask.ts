import Q = require('q');
import fs = require('fs');
import path = require('path');
import url = require('url');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

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

        // set required environment variables
        if(debugLog) {
            tl.setEnvVar('npm_config_loglevel', 'verbose');
        }
        tl.setEnvVar('npm_config_userconfig', tempNpmrcPath);

        try{
            await runNpmAuthHelperAsync(getNpmAuthHelperRunner(npmrcPath, tempNpmrcPath, debugLog));
            await tryRunNpmConfigAsync(getNpmConfigRunner(debugLog));
            var code : number =  await runNpmCommandAsync(npmRunner);
            tl.setResult(code, tl.loc('NpmReturnCode', code));
        } catch (err) {
            cleanUpTempNpmrcPath(tempNpmrcPath);
            tl.setResult(tl.TaskResult.Failed, tl.loc('NpmFailed', err.message));
        }
    }
}

async function runNpmAuthHelperAsync(npmAuthRunner: trm.ToolRunner) : Promise<number> {
    try{
        var code : number = await npmAuthRunner.exec();
        tl.debug('Authentication succeeded with code: ' + code);
        return Q(code);
    } catch (err) {
        tl.debug(tl.loc('NpmAuthFailed', err.message));
        throw err;
    }
}

async function tryRunNpmConfigAsync(npmConfigRunner: trm.ToolRunner) {
    try {
        var code = await npmConfigRunner.exec();
    } catch (err) {
        // do not throw on this failure.
        tl.warning(tl.loc('NpmConfigFailed', err.Message));
    }
}

async function runNpmCommandAsync(npmCommandRunner: trm.ToolRunner) : Promise<number> {
    try{
        var code: number = await npmCommandRunner.exec();
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
    tl.setEnvVar('npm_config_userconfig', '');
    tl.setEnvVar('npm_config_loglevel', '');
    if(tl.exist(tempUserNpmrcPath)) {
        tl.debug('deleting temporary npmrc...');
        tl.rmRF(tempUserNpmrcPath, /* continueOnError */ false);
    }
}