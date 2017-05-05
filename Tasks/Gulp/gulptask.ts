/// <reference path="typings/index.d.ts" />

import path = require('path');
import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');

async function executeTask() {
	try {
		tl.setResourcePath(path.join(__dirname, 'task.json'));
		var gulpFilePath = tl.getDelimitedInput('gulpFile', '\n', true);
		var gulp = tl.which('gulp', false);
		var cwd = tl.getPathInput('cwd', true, false);

		tl.debug('check path : ' + gulp);
		if (!tl.exist(gulp)) {
			tl.debug('not found global installed gulp, try to find gulp locally.');
			var gt = tl.tool(tl.which('node', true));
			var gulpjs = tl.getInput('gulpjs', true);
			gulpjs = path.resolve(cwd, gulpjs);
			tl.debug('check path : ' + gulpjs);
			if (!tl.exist(gulpjs)) {
				tl.setResult(tl.TaskResult.Failed, tl.loc('GulpNotInstalled', gulpjs));
				return;
			}
			gt.arg(gulpjs);
		}
		else {
			var gt = tl.tool(gulp);
		}

		// optional - no targets will concat nothing
		gt.arg(tl.getDelimitedInput('targets', ' ', false));
		gt.arg('--gulpfile');

		//temp path to gulpfile.js, it will get overridden later
		gt.arg("temp/gulpfile.js");

		if(path.relative(cwd, tl.getVariable("System.DefaultWorkingDirectory")) != "") {
			gt.arg("--cwd");
			gt.arg(cwd);
		}
		
		gt.line(tl.getInput('arguments', false));

		for (var gulpFile of getGulpFiles(gulpFilePath)) {
			substituteGulpFilePath(gt, gulpFile);
			await gt.exec().then(function (code) {
				console.log(tl.loc('GulpReturnCode', code));
			}, function (err) {
				tl.debug('taskRunner fail');
				throw new Error(tl.loc('GulpFailed', err.message));
			})
		}
	}
	catch (error) {
		tl.setResult(tl.TaskResult.Failed, error);
	}
}

function getGulpFiles(gulpFilePath: string[]): string[] {
	var gulpFiles = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory"), gulpFilePath);
	if (!gulpFiles || gulpFiles.length === 0) {
		throw new Error(tl.loc('NoGulpFileFound', gulpFilePath));
	}
	return gulpFiles;
}

function substituteGulpFilePath(gt: trm.ToolRunner, filePath: string) {
	var indexOfGulpFile = gt.args.indexOf("--gulpfile");
	if (indexOfGulpFile >= 0) {
		gt.args[indexOfGulpFile + 1] = filePath;
	}
}

executeTask();