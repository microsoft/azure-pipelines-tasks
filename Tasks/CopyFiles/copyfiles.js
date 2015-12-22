/// <reference path="../../definitions/vso-task-lib.d.ts" />
var path = require('path');
var os = require('os');
var tl = require('vso-task-lib/vsotask');
function getCommonLocalPath(files) {
    if (!files || files.length === 0) {
        return "";
    }
    else if (files.length === 1) {
        return path.dirname(files[0]);
    }
    else {
        var root = files[0];
        for (var index = 1; index < files.length; index++) {
            root = _getCommonLocalPath(root, files[index]);
            if (!root) {
                break;
            }
        }
        return root;
    }
}
function _getCommonLocalPath(path1, path2) {
    var path1Depth = getFolderDepth(path1);
    var path2Depth = getFolderDepth(path2);
    var shortPath;
    var longPath;
    if (path1Depth >= path2Depth) {
        shortPath = path2;
        longPath = path1;
    }
    else {
        shortPath = path1;
        longPath = path2;
    }
    while (!isSubItem(longPath, shortPath)) {
        var parentPath = path.dirname(shortPath);
        if (path.normalize(parentPath) === path.normalize(shortPath)) {
            break;
        }
        shortPath = parentPath;
    }
    return shortPath;
}
function isSubItem(item, parent) {
    item = path.normalize(item);
    parent = path.normalize(parent);
    return item.substring(0, parent.length) == parent
        && (item.length == parent.length || (parent.length > 0 && parent[parent.length - 1] === path.sep) || (item[parent.length] === path.sep));
}
function getFolderDepth(fullPath) {
    if (!fullPath) {
        return 0;
    }
    var current = path.normalize(fullPath);
    var parentPath = path.dirname(current);
    var count = 0;
    while (parentPath !== current) {
        ++count;
        current = parentPath;
        parentPath = path.dirname(current);
    }
    return count;
}
tl.setResourcePath(path.join(__dirname, 'task.json'));
// contents is a multiline input containing glob patterns
var contents = tl.getDelimitedInput('Contents', '\n', true);
var sourceFolder = tl.getPathInput('SourceFolder', true, true);
var targetFolder = tl.getPathInput('TargetFolder', true);
var cleanTargetFolder = tl.getBoolInput('CleanTargetFolder', false);
var overWrite = tl.getBoolInput('OverWrite', false);
// not use common root for now. 
//var useCommonRoot: boolean = tl.getBoolInput('UseCommonRoot', false);
var useCommonRoot = false;
// include filter
var includeContents = [];
// exclude filter
var excludeContents = [];
for (var i = 0; i < contents.length; i++) {
    var pattern = contents[i].trim();
    var negate = false;
    var negateOffset = 0;
    for (var j = 0; j < pattern.length && pattern[j] === '!'; j++) {
        negate = !negate;
        negateOffset++;
    }
    if (negate) {
        tl.debug('exclude content pattern: ' + pattern);
        var realPattern = pattern.substring(0, negateOffset) + path.join(sourceFolder, pattern.substring(negateOffset));
        excludeContents.push(realPattern);
    }
    else {
        tl.debug('include content pattern: ' + pattern);
        var realPattern = path.join(sourceFolder, pattern);
        includeContents.push(realPattern);
    }
}
// enumerate all files    
var files = [];
var allPaths = tl.find(sourceFolder);
var allFiles = [];
// remove folder path
for (var i = 0; i < allPaths.length; i++) {
    if (!tl.stats(allPaths[i]).isDirectory()) {
        allFiles.push(allPaths[i]);
    }
}
// if we only have exclude filters, we need add a include all filter, so we can have something to exclude.
if (includeContents.length == 0 && excludeContents.length > 0) {
    includeContents.push('**');
}
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
        var pattern = includeContents[i];
        tl.debug('Include matching ' + pattern);
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
    // apply exclude filter
    for (var i = 0; i < excludeContents.length; i++) {
        var pattern = excludeContents[i];
        tl.debug('Exclude matching ' + pattern);
        // let minimatch do the actual filtering
        var matches = tl.match(files, pattern, matchOptions);
        tl.debug('Exclude matched ' + matches.length + ' files');
        files = [];
        for (var j = 0; j < matches.length; j++) {
            var matchPath = matches[j];
            files.push(matchPath);
        }
    }
}
else {
    tl.debug("Either includeContents or allFiles is empty");
}
// copy the files to the target folder
console.log(tl.loc('FoundNFiles', files.length));
if (files.length > 0) {
    // dump all files to debug trace.
    files.forEach(function (file) {
        tl.debug('file:' + file + ' will be copied.');
    });
    // clean target folder if requied
    if (cleanTargetFolder) {
        console.log(tl.loc('CleaningTargetFolder', targetFolder));
        tl.rmRF(targetFolder);
    }
    // make sure the target folder exists
    tl.mkdirP(targetFolder);
    var commonRoot = "";
    if (useCommonRoot) {
        var computeCommonRoot = getCommonLocalPath(files);
        if (!!computeCommonRoot) {
            commonRoot = computeCommonRoot;
        }
        else {
            commonRoot = sourceFolder;
        }
        tl.debug("There is a common root (" + commonRoot + ") for the files. Using the remaining path elements in target folder.");
    }
    try {
        var createdFolders = {};
        files.forEach(function (file) {
            var relativePath = file.substring(sourceFolder.length)
                .replace(/^\\/g, "")
                .replace(/^\//g, "");
            if (useCommonRoot) {
                relativePath = file.substring(commonRoot.length)
                    .replace(/^\\/g, "")
                    .replace(/^\//g, "");
            }
            var targetPath = path.join(targetFolder, relativePath);
            var targetDir = path.dirname(targetPath);
            if (!createdFolders[targetDir]) {
                tl.debug("Creating folder " + targetDir);
                tl.mkdirP(targetDir);
                createdFolders[targetDir] = true;
            }
            if (tl.exist(targetPath) && tl.stats(targetPath).isFile() && !overWrite) {
                console.log(tl.loc('FileAlreadyExistAt', file, targetPath));
            }
            else {
                console.log(tl.loc('CopyingTo', file, targetPath));
                tl.cp("-f", file, targetPath);
            }
        });
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    }
}
