var tl = require('vso-task-lib');
var path = require('path');

// if output is rooted ($(build.buildDirectory)/output/...), will resolve to fully qualified path, 
// else relative to repo root
var out = path.resolve(tl.getVariable('build.sourceDirectory'),
	                            tl.getInput('outputPattern', true));
tl.mkdirP(out);