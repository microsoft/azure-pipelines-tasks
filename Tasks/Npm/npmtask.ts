import fs = require('fs');
import path = require('path');
import url = require('url');
import tl = require('vsts-task-lib/task');
import tr = require('vsts-task-lib/toolrunner');

tl.setResourcePath(path.join( __dirname, 'task.json'));

var npm = tl.createToolRunner(tl.which('npm', true));

var cwd = tl.getPathInput('cwd', true, false);
tl.mkdirP(cwd);
tl.cd(cwd);

var command = tl.getInput('command', true);
if (command.indexOf(' ') >= 0) {
	tl.setResult(tl.TaskResult.Failed, tl.loc("InvalidCommand"));
}

if(tl.getVariable('USE_DEPRECATED_TASK_VERSION') != undefined && tl.getVariable('USE_DEPRECATED_TASK_VERSION').toLowerCase() === 'true') {
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
	var tempUserNpmrPath: string = npmrcPath.concat('.', tl.getVariable('build.buildId'), '.auth');
    var debugLog: boolean = true;
	if (tl.getVariable('system.debug') != undefined && tl.getVariable('system.debug').toLowerCase() === 'false') {
        debugLog = false;
    }

	npm.arg(command);
	npm.argString(tl.getInput('arguments', false));

	getNpmAuthHelperRunner(npmrcPath, tempUserNpmrPath, debugLog).exec()
	.then(function(code){
		if(debugLog) {
			tl.setEnvVar('npm_config_loglevel', 'verbose');
		}
		tl.setEnvVar('npm_config_userconfig', tempUserNpmrPath);
		getNpmConfigRunner(debugLog).exec()
		.fail(function(err){
			tl.warning(tl.loc('NpmConfigFailed', err.Message));
		})
		.finally(function(){
			npm.exec()
			.then(function(code) {
				cleanUpTempNpmrcPath(tempUserNpmrPath);
				tl.setResult(code, tl.loc('NpmReturnCode', code));
			})
			.fail(function(err) {
				cleanUpTempNpmrcPath(tempUserNpmrPath);
				tl.setResult(tl.TaskResult.Failed, tl.loc('NpmFailed', err.message));
			})	
		})
	})
	.fail(function(err) {
		cleanUpTempNpmrcPath(tempUserNpmrPath);
		tl.setResult(tl.TaskResult.Failed, tl.loc('NpmAuthFailed', err.message));
	})
}

function getNpmAuthHelperRunner(npmrcPath: string, tempUserNpmrcPath: string, includeDebugLogs: boolean): tr.ToolRunner {
	var npmAuthHelper = tl.createToolRunner(path.join(__dirname, 'Npm/vsts-npm-auth/bin/vsts-npm-auth.exe'));
	npmAuthHelper.arg('-N')
	npmAuthHelper.arg('-V')
	npmAuthHelper.arg(includeDebugLogs ? 'Detailed' : 'Normal')
	npmAuthHelper.argString('-C');
	npmAuthHelper.arg(npmrcPath);
	npmAuthHelper.arg('-T');
	npmAuthHelper.arg(tempUserNpmrPath);
	return npmAuthHelper;
}

function getNpmConfigRunner(includeDebugLogs: boolean): tr.ToolRunner {
	var npmConfig = tl.createToolRunner(tl.which('npm', true));
	npmConfig.argString('config list');
	if(includeDebugLogs) {
		npmConfig.arg('-l');
	}
	return npmConfig;
}

function cleanUpTempNpmrcPath(tempUserNpmrcPath: string) {
	tl.debug('cleaning up...')
	tl.setEnvVar('npm_config_userconfig', '');
	if(tl.exist(tempUserNpmrcPath)) {
		tl.debug('deleting temporary npmrc...');
		tl.rmRF(tempUserNpmrcPath, false);
	}
}