/*
  Copyright (c) Microsoft. All rights reserved.
  Licensed under the MIT license. See LICENSE file in the project root for full license information.
*/

/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vso-task-lib.d.ts" />

import path = require('path');
import fs = require('fs');
import Q = require('q');
import tl = require("vso-task-lib/vsotask");

// Define error handler
var onError = function (errorMsg) {
    tl.error(errorMsg);
    tl.exit(1);
}

/*
Signing the specified file.  Move the current file to fn.unsigned, and
place the signed file at the same location fn
*/
var jarsigning = (fn: string) => {
    // file must exist
    tl.checkPath(fn, 'file to sign');

    var java_home = tl.getVariable('JAVA_HOME');
    var jarsigner = path.join(java_home, 'bin', 'jarsigner');

    var jarsignerRunner = tl.createToolRunner(jarsigner);

    // Get keystore file for signing
    var keystoreFile = tl.getInput('keystoreFile', true);
    tl.debug('keystoreFile: ' + keystoreFile);

    // Get keystore alias
    var keystoreAlias = tl.getInput('keystoreAlias', true);
    tl.debug('keystoreAlias: ' + keystoreAlias);

    var keystorePass = tl.getInput('keystorePass', false);
    tl.debug('keystorePass nil?: ' + !keystorePass)

    var keyPass = tl.getInput('keyPass', false);
    tl.debug('keyPass nil?: ' + !keyPass)

    var jarsignerArguments = tl.getInput('jarsignerArguments', false);
    tl.debug("jarsignerArguments: " + jarsignerArguments);

    jarsignerRunner.arg(['-keystore', keystoreFile]);

    if (keystorePass) {
        jarsignerRunner.arg(['-storepass', keystorePass]);
    }

    if (keyPass) {
        jarsignerRunner.arg(['-keypass', keyPass]);
    }

    if (jarsignerArguments) {
        jarsignerRunner.arg(jarsignerArguments);
    }

    var unsignedFn = fn + ".unsigned"; 
    var success = tl.mv(fn, unsignedFn, true, false);

    jarsignerRunner.arg(['-signedjar', fn, unsignedFn, keystoreAlias]);
    
    return jarsignerRunner.exec(null);
}

/*
Zipaligning apk
*/
var zipaligning = (fn: string) => {
    // file must exist
    tl.checkPath(fn, 'file to zipalign');

    var zipaligner = tl.getInput('zipalignLocation', false);
    tl.debug("zipalign tool: " + zipaligner);

    // if the tool path is not set, let's find one (anyone) from the SDK folder
    if (!zipaligner) {
        
        var android_home = tl.getVariable('ANDROID_HOME');
        if (!android_home) {
            onError("ANDROID_HOME is not set");
        }
    
        var allFiles = tl.find(path.join(android_home, 'build-tools'));
        // Now matching the pattern against all files
        var zipalignToolsList = tl.match(allFiles, "zipalign*", {matchBase: true});

        if (!zipalignToolsList || zipalignToolsList.length === 0) {
            onError("Could not find zipalign tool inside ANDROID_HOME: " + android_home);
        }

        zipaligner = zipalignToolsList[0];
    }

    if (!zipaligner) {
         onError("Could not find zipalign tool.");
    }

    var zipalignRunner = tl.createToolRunner(zipaligner);

    // alignment must be 4 or play store will reject, hard code this to avoid user errors
    zipalignRunner.arg(["-v", "4"]);

    var unalignedFn = fn + ".unaligned"; 
    var success = tl.mv(fn, unalignedFn, true, false);
    
    zipalignRunner.arg([unalignedFn, fn]);
    return zipalignRunner.exec(null);
}

var process = (fn: string) => {

    tl.debug('process '+fn);

    return Q.fcall(() => {
       if (jarsign) {
           return jarsigning(fn);
       }

       return Q(0);
    })
    .then(() => {
        if (zipalign) {
            return zipaligning(fn);
        }

        return Q(0);
    })
}

//-----------------------------------------------------------------------------
// Program
//-----------------------------------------------------------------------------
// Get files to be signed 
var filesPattern = tl.getInput('files', true);
tl.debug('filesPattern: ' + filesPattern); 

// Signing the APK?
var jarsign: boolean = tl.getBoolInput('jarsign');
tl.debug('jarsign: ' + jarsign);

// Zipaligning the APK?
var zipalign: boolean = tl.getBoolInput('zipalign');
tl.debug('zipalign: ' + zipalign);

// Resolve files for the specified value or pattern
if (filesPattern.indexOf('*') == -1 && filesPattern.indexOf('?') == -1) {
    // No pattern found, check literal path to a single file
    tl.checkPath(filesPattern, 'files');

    // Use the specified single file
    var filesList = [filesPattern];

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
    tl.debug('Matching glob pattern: ' + filesPattern);

    // First find the most complete path without any matching patterns
    var idx = firstWildcardIndex(filesPattern);
    tl.debug('Index of first wildcard: ' + idx);
    var findPathRoot = path.dirname(filesPattern.slice(0, idx));

    tl.debug('find root dir: ' + findPathRoot);

    // Now we get a list of all files under this root
    var allFiles = tl.find(findPathRoot);

    // Now matching the pattern against all files
    var filesList: string[] = tl.match(allFiles, filesPattern, {matchBase: true});

    // Fail if no matching app files were found
    if (!filesList || filesList.length == 0) {
        onError('No matching files were found with search pattern: ' + filesPattern);
    }
}

var result = Q({});
filesList.forEach((fn) => {
    result = result.then(() => {
        return process(fn);
    })
})

result.then(() => {
    tl.exit(0);
})
.fail((err) => {
    tl.error(err);
    tl.exit(1);
});
