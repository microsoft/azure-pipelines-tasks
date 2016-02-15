/// <reference path="../../definitions/vsts-task-lib.d.ts" />

import path = require('path');
import os = require('os');
import tl = require('vsts-task-lib/task');
tl.setResourcePath(path.join(__dirname, 'task.json'));

// contents is a multiline input containing glob patterns
var contents: string[] = tl.getDelimitedInput('Contents', '\n', true);
var sourceFolder = tl.getPathInput('SourceFolder', true, true);

// Input that is used for backward compatibility with pre-sprint 95 symbol store artifacts.
// Pre-95 symbol store artifacts were simply file path artifacts, so we need to make sure
// not to delete the artifact share if it's a symbol store.
var buildCleanup = tl.getBoolInput('BuildCleanup');

// include filter
var includeContents = [];

for (var i = 0; i < contents.length; i++) {
    var pattern = contents[i].trim();
    tl.debug('include content pattern: ' + pattern);
    var realPattern = path.join(sourceFolder, pattern);
    includeContents.push(realPattern);        
}

// enumerate all files
var files = [];
var allPaths = tl.find(sourceFolder);
tl.debug('allPaths: ' + allPaths);
if (allPaths.length === 0) {
    tl.debug('source folder not found. nothing to delete.');
}

var allFiles: string[] = [];
var allFolders: string[] = [];

// folders should be deleted last
for (var i = 0; i < allPaths.length; i++) {
    // Don't delete symbol store shares if this is a cleanup job for file-path artifacts.
    //
    // This check needs to be made based on the result of tl.find(). Otherwise intermittent network
    // issues could result in a false assertion that the share is not a symbol store share.
    //
    // Opted to check each item name rather than the full path. Although it would suffice to check
    // for 000Admin at the root of the share, it is difficult to accurately make a determination
    // based on the full path. The problem is that the input share path would need to be run through
    // a normalization function that could be trusted 100% to match the format produced by tl.find().
    // For example if the input contains "\\\share", it would need to be normalized as "\\share". To
    // avoid worrying about catching every normalization edge case, checking the item name suffices instead.
    if (buildCleanup && path.basename(allPaths[i]).toLowerCase() == '000admin') {
        tl.warning(tl.loc('SkippingSymbolStore', sourceFolder))
        process.exit(0);
    }

    tl.debug("checking for directory: " + allPaths[i]);
    if (!tl.stats(allPaths[i]).isDirectory()) {
        allFiles.push(allPaths[i]);
    }
    else {
        allFolders.push(allPaths[i]);
    }
}
allFiles = allFiles.concat(allFolders);

if (includeContents.length > 0 && allFiles.length > 0) {
    tl.debug("allFiles contains " + allFiles.length + " files");
    // a map to eliminate duplicates
    var map = {};
    // minimatch options
    var matchOptions = { matchBase: true };
    if (os.type().match(/^Win/)) {
        matchOptions["nocase"] = true;
    }
    // apply include filter
    for (var i = 0; i < includeContents.length; i++) {
        var pattern: string = includeContents[i];
        tl.debug('Include matching: ' + pattern);
        // let minimatch do the actual filtering
        var matches = tl.match(allFiles, pattern, matchOptions);
        tl.debug('Include matched ' + matches.length + ' files');
        for (var j = 0; j < matches.length; j++) {
            var matchPath = matches[j];
            if (!map.hasOwnProperty(matchPath)) {
                map[matchPath] = true;
                files.push(matchPath);
            }
        }
    }
}
else {
    tl.debug("Either includeContents or allFiles is empty");
}

// try to delete all files/folders, even if one errs
var errorHappened: boolean = false;
for (var i: number = 0; i < files.length; i++){
    try {
        tl.debug("trying to delete: " + files[i]);
        tl.rmRF(files[i]);
    }
    catch (err) {
        tl.error(err);
        errorHappened = true;
    }
}

if (errorHappened) {
    tl.setResult(tl.TaskResult.Failed, tl.loc("CantDeleteFiles"));
}
