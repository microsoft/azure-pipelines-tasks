/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');

//read inputs
var solution = tl.getPathInput('solution', true, false);
var platform = tl.getInput('platform');
var configuration = tl.getInput('configuration');
var msbuildArguments = tl.getInput('msbuildArguments');
var clean = tl.getBoolInput('clean');
var logsolutionEvents = tl.getBoolInput('logsolutionEvents');
if(logsolutionEvents) {
    tl.warning('logSolutionEvents property is not supported on the VSTS node agent.');
}
var msbuildLocationMethod = tl.getInput('msbuildLocationMethod');
if(!msbuildLocationMethod) {
    msbuildLocationMethod = 'version';
}

var xbuildToolPath = tl.which('xbuild'); //ignore msbuild version on non-Windows platforms, use xbuild
if(msbuildLocationMethod == 'location') {
    xbuildToolPath = tl.getInput('msbuildLocation');
}

var runxbuild = function (fn, clean) {
    return Q.fcall( () => {
        var xbuild = tl.createToolRunner(xbuildToolPath);
        xbuild.pathArg(fn);
        if(clean) {
            xbuild.arg('/t:Clean');
        }
        if (platform) {
            xbuild.arg('/p:Platform=' + platform);
        }
        if (configuration) {
            xbuild.arg('/p:Configuration=' + configuration);
        }
        if (msbuildArguments) {
            xbuild.argString(msbuildArguments);
        }

        return xbuild.exec();
    });
}

// Resolve files for the specified value or pattern
var filesList : string [];
if (solution.indexOf('*') == -1 && solution.indexOf('?') == -1) {
    // No pattern found, check literal path to a single file
    tl.checkPath(solution, 'files');

    // Use the specified single file
    filesList = [solution];

} else {
    var firstWildcardIndex = function(str) {
        var idx = str.indexOf('*');

        var idxOfWildcard = str.indexOf('?');
        if (idxOfWildcard > -1) {
            return (idx > -1) ?
                Math.min(idx, idxOfWildcard) : idxOfWildcard;
        }

        return idx;
    }

    // Find app files matching the specified pattern
    tl.debug('Matching glob pattern: ' + solution);

    // First find the most complete path without any matching patterns
    var idx = firstWildcardIndex(solution);
    tl.debug('Index of first wildcard: ' + idx);
    var findPathRoot = path.dirname(solution.slice(0, idx));

    tl.debug('find root dir: ' + findPathRoot);

    // Now we get a list of all files under this root
    var allFiles = tl.find(findPathRoot);

    // Now matching the pattern against all files
    filesList = tl.match(allFiles, solution, {matchBase: true});

    // Fail if no matching .csproj files were found
    if (!filesList || filesList.length == 0) {
        tl.error('No matching files were found with search pattern: ' + solution);
        tl.exit(1);
    }
}

var result = Q(<any>{});
filesList.forEach((fn) => {
    result = result.then(() => {
        if (clean) {
            runxbuild(fn, true).then( () => {
                return runxbuild(fn, false);
            });
        } else {
            return runxbuild(fn, false);
        }
    })
})
result.then(() => {
    tl.exit(0);
})
.fail((err) => {
    tl.error(err);
    tl.exit(1);
});

