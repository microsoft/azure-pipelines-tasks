import Q = require('q');
import fs = require('fs');
import path = require('path');
import url = require('url');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

tl.setResourcePath(path.join( __dirname, 'task.json'));

var npm = tl.createToolRunner(tl.which('npm', true));

var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);

var command = tl.getInput('command', true);
if (command.indexOf(' ') >= 0) {
	tl.setResult(tl.TaskResult.Failed, tl.loc("InvalidCommand"));
}

if(shouldUseDeprecatedTask()) {
	npm.arg(command);
	npm.argString(tl.getInput('arguments', false));

	npm.exec()
	.then(function(code) {
		tl.setResult(code, tl.loc('NpmReturnCode', code));
	})
	.fail(function(err) {
		tl.debug('taskRunner fail');
		tl.setResult(tl.TaskResult.Failed, tl.loc('NpmFailed', err.message));
	})
} else {
	// new task version with auth support
	
	var npmrcPath: string = path.join(cwd, '.npmrc');
	var tempNpmrcPath : string = getTempNpmrcPath();
    var debugLog: boolean = true;
	if (tl.getVariable('system.debug') != undefined && tl.getVariable('system.debug').toLowerCase() === 'false') {
        debugLog = false;
    }

	npm.arg(command);
	npm.argString(tl.getInput('arguments', false));

	runNpmWithAuthAsync(
		getNpmAuthHelperRunner(npmrcPath, tempNpmrcPath, debugLog),
		getNpmConfigRunner(debugLog),
		npm,
		tempNpmrcPath,
		debugLog)
	.then(code => {
		tl.setResult(code, tl.loc('NpmReturnCode', code));
	})
	.catch(err => {
		tl.setResult(tl.TaskResult.Failed, tl.loc('NpmFailed', err.message));
	});
}

async function runNpmWithAuthAsync(
	npmAuthRunner: trm.ToolRunner, 
	npmConfigRunner: trm.ToolRunner, 
	npmCommandRunner: trm.ToolRunner,
	tempUserNpmrPath: string,
	debugLog: boolean) : Promise<number> {
		
	try {
		
		if(debugLog) {
			tl.setEnvVar('npm_config_loglevel', 'verbose');
		}
		tl.setEnvVar('npm_config_userconfig', tempUserNpmrPath);

		var code : number = await runNpmAuthHelperAsync(npmAuthRunner);
		await tryRunNpmConfigAsync(npmConfigRunner);
		code = await runNpmCommandAsync(npmCommandRunner);
		return Q(code);
	} finally {
		cleanUpTempNpmrcPath(tempUserNpmrPath);
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