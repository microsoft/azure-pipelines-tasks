var tl = require('vso-task-lib');
var path = require('path');

// if output is rooted ($(build.buildDirectory)/output/...), will resolve to fully qualified path, 
// else relative to repo root
var out = path.resolve(tl.getVariable('build.sourceDirectory'), 
	                            tl.getInput('outputPattern', true));
tl.mkdirP(out);

var tool = tl.which('xctool', false) || tl.which('xcodebuild', true);
var xcv = new tl.ToolRunner(tool);
xcv.arg('-version');

var xcb = new tl.ToolRunner(tool);
xcb.arg('-workspace');
xcb.arg(tl.getPathInput('xcWorkspacePath', true, true));
xcb.arg('-sdk');
xcb.arg(tl.getInput('sdk', true));
xcb.arg('-configuration');
xcb.arg(tl.getInput('configuration', true));
xcb.arg('-scheme');
xcb.arg(tl.getInput('scheme', true));
xcb.arg(tl.getDelimitedInput('actions', ' ', true));
xcb.arg('DSTROOT=' + path.join(out, 'build.dst'));
xcb.arg('OBJROOT=' + path.join(out, 'build.obj'));
xcb.arg('SYMROOT=' + path.join(out, 'build.sym'));
xcb.arg('SHARED_PRECOMPS_DIR=' + path.join(out, 'build.pch'));


xcv.exec()
.then(function(code) {
	return xcb.exec();
})
.then(function(code) {
	tl.exit(code);
})
.fail(function(err) {
	console.error(err.message);
	tl.debug('taskRunner fail');
	tl.exit(1);
})
