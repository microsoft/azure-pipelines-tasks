/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import tl = require('vsts-task-lib/task');

tl.cd(tl.getPathInput('cwd', true, true));

tl.debug('Setting locale to UTF8 - required by CocoaPods');
process.env['LC_ALL'] = 'en_US.UTF-8';

var tool = tl.which('pod');
if (tool) {
    var pod = tl.createToolRunner(tool);
    pod.arg('install');

    pod.exec()
        .then(function(code) {
            tl.exit(code);
        })
        .fail(function(err) {
            tl.debug('taskRunner fail');
            tl.exit(1);
        });
} else {
    tl.error('command pod was not found. Please install Cocoapods on the build machine (https://cocoapods.org)');
    tl.debug('taskRunner fail: pod not found');
    tl.exit(1);
}
