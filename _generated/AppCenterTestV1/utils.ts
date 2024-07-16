import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import glob = require('glob');

export function checkAndFixFilePath(p, name) {
    if (p) {
        var workDir = tl.getVariable("System.DefaultWorkingDirectory");
        if (arePathEqual(p, workDir)) {
            // Path points to the source root, ignore it
            p = null;
        } else {
            // will error and fail task if it doesn't exist.
            tl.checkPath(p, name);
        }
    }

    return p;
}

function arePathEqual(p1, p2) {
    if (!p1 && !p2) return true;
    else if (!p1 || !p2) return false;
    else return path.normalize(p1 || "") === path.normalize(p2 || "");
}

function getAllFiles(rootPath, recursive) {
    var files = [];

    var folders = [];
    folders.push(rootPath);

    while (folders.length > 0) {
        var folderPath = folders.shift();

        var children = fs.readdirSync(folderPath);
        for (var i = 0; i < children.length; i++) {
            var childPath = path.join(folderPath, children[i]);
            if (fs.statSync(childPath).isDirectory()) {
                if (recursive) {
                    folders.push(childPath);
                }
            } else {
                files.push(childPath);
            }
        }
    }

    return files;
}

export function resolveSinglePath(pattern: string): string {
    if (pattern) {
        let matches: string[] = glob.sync(pattern);
        
        if (!matches || matches.length === 0) {
            throw new Error(tl.loc("CannotFindAnyFile",pattern));
        }
        
        if(matches.length != 1) {
            throw new Error(tl.loc("FoundMultipleFiles",pattern));
        }

        return matches[0];
    }

    return null;
}
