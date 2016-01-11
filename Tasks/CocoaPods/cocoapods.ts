/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');

tl.cd(tl.getPathInput('cwd', true, true));

tl.debug('Setting locale to UTF8 - required by CocoaPods');
process.env['LC_ALL']='en_US.UTF-8';

var tool = tl.which('pod', true);
var pod = tl.createToolRunner(tool);
pod.arg('install');

pod.exec()
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	tl.debug('taskRunner fail');
	tl.exit(1);
})
