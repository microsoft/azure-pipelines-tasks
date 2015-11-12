/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts" />
/// <reference path="../../definitions/vso-task-lib.d.ts" />

import path = require('path');
import fs = require('fs');
import os = require('os');
import Q = require('q');
var tl = require("vso-task-lib");

function getCommonLocalPath(files: string[]): string {
    if (!files || files.length === 0) {
        return "";
    }
    else if (files.length === 1) {
        return path.dirname(files[0]);
    }
    else {
        var root: string = files[0];

        for (var index = 1; index < files.length; index++) {
            root = _getCommonLocalPath(root, files[index]);
            if (!root) {
                break;
            }
        }

        return root;
    }
}

function _getCommonLocalPath(path1: string, path2: string): string {
    var path1Depth = getFolderDepth(path1);
    var path2Depth = getFolderDepth(path2);

    var shortPath: string;
    var longPath: string;
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

function isSubItem(item: string, parent: string): boolean {
    item = path.normalize(item);
    parent = path.normalize(parent);
    return item.substring(0, parent.length) == parent
        && (item.length == parent.length || (parent.length > 0 && parent[parent.length - 1] === path.sep) || (item[parent.length] === path.sep));
}

function getFolderDepth(fullPath: string): number {
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

// contents is a multiline input containing glob patterns
var contents: string[] = tl.getDelimitedInput('Contents', '\n');
var sourceFolder: string = tl.getPathInput('SourceFolder');
var targetFolder: string = tl.getPathInput('TargetFolder');

var cleanTargetFolderString: string = tl.getInput('CleanTargetFolder');
var overWriteString: string = tl.getInput('OverWrite');
//var useCommonRootString: string = tl.getInput('UseCommonRoot');

var cleanTargetFolder: boolean = cleanTargetFolderString.trim().toLocaleLowerCase() === "true";
var overWrite: boolean = overWriteString.trim().toLocaleLowerCase() === "true";

// not use common root for now. 
//var useCommonRoot: boolean = useCommonRootString.trim().toLocaleLowerCase() === "true";
var useCommonRoot: boolean = false;

// include filter
var includeContents: string[] = [];
// exclude filter
var excludeContents: string[] = [];

for (var i: number = 0; i < contents.length; i++){
    var pattern = contents[i].trim();
    var negate: Boolean = false;
    var negateOffset: number = 0; 
    for (var j = 0; j < pattern.length && pattern[j] === '!'; j++){
        negate = !negate;
        negateOffset++;
    }
    
    if(negate){
        tl.debug('exclude content pattern: ' + pattern);
        var realPattern = pattern.substring(0, negateOffset) + path.join(sourceFolder, pattern.substring(negateOffset));
        excludeContents.push(realPattern);
    }
    else{
        tl.debug('include content pattern: ' + pattern);
        var realPattern = path.join(sourceFolder, pattern);
        includeContents.push(realPattern);
    }
}

// enumerate all files    
var files: string[] = [];
var allPaths: string[] = tl.find(sourceFolder);
var allFiles: string[] = [];

// remove folder path
for (var i: number = 0; i < allPaths.length; i++) {
    if (!fs.statSync(allPaths[i]).isDirectory()) {
        allFiles.push(allPaths[i]);
    }
}

if (includeContents && allFiles && includeContents.length > 0 && allFiles.length > 0) {
    tl.debug("allFiles contains " + allFiles.length + " files");

    // a map to eliminate duplicates
    var map = {};
    
    // minimatch options
    var matchOptions = { matchBase: true };
    if(os.type().match(/^Win/))
    {
        matchOptions["nocase"] = true;
    }
        
    // apply include filter
    for (var i: number = 0; i < includeContents.length; i++) {
        var pattern = includeContents[i];
        tl.debug('Include matching ' + pattern);        

        // let minimatch do the actual filtering
        var matches: string[] = tl.match(allFiles, pattern, matchOptions);
            
        tl.debug('Include matched ' + matches.length + ' files');
        for (var j: number = 0; j < matches.length; j++) {
            var matchPath = matches[j];
            if (!map.hasOwnProperty(matchPath)) {
                map[matchPath] = true;
                files.push(matchPath);
            }
        }
    }
    
    // apply exclude filter
    for (var i: number = 0; i < excludeContents.length; i++) {
        var pattern = excludeContents[i];
        tl.debug('Exclude matching ' + pattern);

        // let minimatch do the actual filtering
        var matches: string[] = tl.match(files, pattern, matchOptions);
            
        tl.debug('Exclude matched ' + matches.length + ' files');
        files = [];
        for (var j: number = 0; j < matches.length; j++) {
            var matchPath = matches[j];
            files.push(matchPath);
        }
    }
}
else {
    tl.debug("Either includeContents or allFiles is empty");
}

// copy the files to the target folder
console.log("found " + files.length + " files");
if (files.length > 0) {
    
    // clean target folder if requied
    if (cleanTargetFolder) {
        console.log('Cleaning target folder: ' + targetFolder);
        tl.rmRF(targetFolder); 
    }
    
    // make sure the target folder exists
    tl.mkdirP(targetFolder);

    var commonRoot: string = "";    
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
        files.forEach((file: string) => {
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
            
            var exists = fs.existsSync(targetPath);
            var stats = exists && fs.statSync(targetPath);
      
            if (exists && stats.isFile() && !overWrite) {
                console.log("File " + file + " already exist at " + targetPath);
            }
            else {
                console.log("Copying " + file + " to " + targetPath);
                tl.cp("-f", file, targetPath);                
            }
        });
    }
    catch (err) {
        tl.error(err);
        tl.exit(1);
    }
}
