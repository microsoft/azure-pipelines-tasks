/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');

//read inputs
var project = tl.getPathInput('project', true);
var target = tl.getInput('target');
var outputDir = tl.getInput('outputDir');
var configuration = tl.getInput('configuration');
var xbuildLocation = tl.getPathInput('msbuildLocation');
var msbuildArguments = tl.getInput('msbuildArguments');

// find jdk to be used during the build
var jdkSelection = tl.getInput('jdkSelection');
if(!jdkSelection) {
    jdkSelection = 'JDKVersion'; //fallback to JDKVersion for older version of tasks
}
var specifiedJavaHome = null;

if (jdkSelection == 'JDKVersion') {
    tl.debug('Using JDK version to find JDK path');
    var jdkVersion = tl.getInput('jdkVersion');
    var jdkArchitecture = tl.getInput('jdkArchitecture');

    if(jdkVersion != 'default') {
        // jdkVersion should be in the form of 1.7, 1.8, or 1.10
        // jdkArchitecture is either x64 or x86
        // envName for version 1.7 and x64 would be "JAVA_HOME_7_X64"
        var envName = "JAVA_HOME_" + jdkVersion.slice(2) + "_" + jdkArchitecture.toUpperCase();
        specifiedJavaHome = tl.getVariable(envName);
        if (!specifiedJavaHome) {
            tl.error('Failed to find specified JDK version. Please make sure environment variable ' + envName + ' exists and is set to the location of a corresponding JDK.');
            tl.exit(1);
        }
    }
}
else {
    tl.debug('Using path from user input to find JDK');
    var jdkUserInputPath = tl.getPathInput('jdkUserInputPath', true, true);
    specifiedJavaHome = jdkUserInputPath;
}

//find xbuild location to use
var xbuildToolPath = tl.which('xbuild');
if(xbuildLocation) {
    xbuildToolPath = xbuildLocation + '/xbuild';
}
if(!xbuildToolPath) {
    tl.error('xbuild was not found in the path.');
    tl.exit(1);
}

var runxbuild = function (fn) {
    return Q.fcall( () => {
        var xbuild = tl.createToolRunner(xbuildToolPath);
        xbuild.pathArg(fn);

        if (target) {
            xbuild.arg('/t:' + target);
        }
        xbuild.arg('/t:PackageForAndroid');
        if (msbuildArguments) {
            xbuild.argString(msbuildArguments);
        }
        if (outputDir) {
            xbuild.arg('/p:OutputPath=' + outputDir);
        }
        if(configuration) {
            xbuild.arg('/p:Configuration=' + configuration);
        }
        if (specifiedJavaHome) {
            xbuild.arg('/p:JavaSdkDirectory=' + specifiedJavaHome);
        }

        return xbuild.exec();
    });
}

// Resolve files for the specified value or pattern
var filesList : string [];
if (project.indexOf('*') == -1 && project.indexOf('?') == -1) {
    // No pattern found, check literal path to a single file
    tl.checkPath(project, 'files');

    // Use the specified single file
    filesList = [project];

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
    tl.debug('Matching glob pattern: ' + project);

    // First find the most complete path without any matching patterns
    var idx = firstWildcardIndex(project);
    tl.debug('Index of first wildcard: ' + idx);
    var findPathRoot = path.dirname(project.slice(0, idx));

    tl.debug('find root dir: ' + findPathRoot);

    // Now we get a list of all files under this root
    var allFiles = tl.find(findPathRoot);

    // Now matching the pattern against all files
    filesList = tl.match(allFiles, project, {matchBase: true});

    // Fail if no matching .csproj files were found
    if (!filesList || filesList.length == 0) {
        tl.error('No matching files were found with search pattern: ' + project);
        tl.exit(1);
    }
}

var result = Q({});
filesList.forEach((fn) => {
    result = result.then(() => {
        return runxbuild(fn);
    })
})

result.then(() => {
    tl.exit(0);
})
.fail((err) => {
    tl.error(err);
    tl.error('See http://go.microsoft.com/fwlink/?LinkId=760847');
    tl.exit(1);
});




