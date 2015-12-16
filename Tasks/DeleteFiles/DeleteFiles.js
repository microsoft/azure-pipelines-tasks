/// <reference path="../../definitions/vso-task-lib.d.ts" />
var path = require('path');
var os = require('os');
var tl = require('vso-task-lib/vsotask');
// contents is a multiline input containing glob patterns
var contents = tl.getDelimitedInput('Contents', '\n');
var sourceFolder = tl.getPathInput('SourceFolder');
// include filter
var includeContents = [];
// exclude filter
var excludeContents = [];
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
var allFiles = [];
var allFolders = [];
// folders should be deleted last
for (var i = 0; i < allPaths.length; i++) {
    tl.debug("checking for directory: " + allPaths[i]);
    if (!tl.stats(allPaths[i]).isDirectory()) {
        allFiles.push(allPaths[i]);
    }
    else {
        allFolders.push(allPaths[i]);
    }
}
allFiles = allFiles.concat(allFolders);
if (includeContents && allFiles && includeContents.length > 0 && allFiles.length > 0) {
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
        var pattern = includeContents[i];
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
var errorHappened = false;
for (var i = 0; i < files.length; i++) {
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
    tl.setResult(1, tl.loc("CantDeleteFiles", "Couldn't delete one or more files"));
}
