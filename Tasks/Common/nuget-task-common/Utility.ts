/// <reference path="../../../definitions/Q.d.ts" />

import * as tl from 'vsts-task-lib/task';
import * as path from 'path'
import * as os from 'os';

// Attempts to resolve paths the same way the legacy PowerShell's Find-Files worked
export function resolveFilterSpec(filterSpec: string, basePath?: string, allowEmptyMatch?: boolean): string[] {
    // make sure to remove any empty entries, or else we'll accidentally match the current directory.
    let patterns = filterSpec.split(";").map(x => x.trim()).filter(x => !!x);
    let result = new Set<string>();

    patterns.forEach(pattern => {
        let isNegative = false;
        if (pattern.startsWith("+:")) {
            pattern = pattern.substr(2);
        }
        else if (pattern.startsWith("-:")) {
            pattern = pattern.substr(2);
            isNegative = true;
        }

        if (basePath) {
            pattern = path.resolve(basePath, pattern);
        }

        tl.debug(`pattern: ${pattern}, isNegative: ${isNegative}`);

        let thisPatternFiles = resolveWildcardPath(pattern, true);
        thisPatternFiles.forEach(file => {
            if (isNegative) {
                result.delete(file);
            }
            else {
                result.add(file);
            }
        });
    });

    // Fail if no matching files were found
    if (!allowEmptyMatch && (!result || result.size == 0)) {
        throw new Error('No matching files were found with search pattern: ' + filterSpec);
    }

    return Array.from(result);
}

export function resolveWildcardPath(pattern: string, allowEmptyWildcardMatch?: boolean): string[] {
    let isWindows = os.platform() === 'win32';
    
    // Resolve files for the specified value or pattern
    var filesList: string[];

    // empty patterns match nothing (otherwise they will effectively match the current directory)
    if (!pattern) {
        filesList = [];
    }
    else if (pattern.indexOf('*') == -1 && pattern.indexOf('?') == -1) {
        
        // No pattern found, check literal path to a single file
        tl.checkPath(pattern, 'files');

        // Use the specified single file
        filesList = [pattern];

    } else {
        var firstWildcardIndex = function (str) {
            var idx = str.indexOf('*');

            var idxOfWildcard = str.indexOf('?');
            if (idxOfWildcard > -1) {
                return (idx > -1) ?
                    Math.min(idx, idxOfWildcard) : idxOfWildcard;
            }

            return idx;
        }

        // Find app files matching the specified pattern
        tl.debug('Matching glob pattern: ' + pattern);

        // First find the most complete path without any matching patterns
        var idx = firstWildcardIndex(pattern);
        tl.debug('Index of first wildcard: ' + idx);
        var findPathRoot = path.dirname(pattern.slice(0, idx));

        tl.debug('find root dir: ' + findPathRoot);

        // Now we get a list of all files under this root
        var allFiles = tl.find(findPathRoot);

        // Now matching the pattern against all files
        // Turn off a bunch of minimatch features to replicate the behavior of Find-Files in the old PowerShell tasks
        let patternFilter = tl.filter(
            pattern, {
                matchBase: true,
                nobrace: true,
                noext: true,
                nocomment: true,
                nonegate: true,
                nocase: isWindows,
                dot: isWindows
            });

        filesList = allFiles.filter(patternFilter);

        // Avoid matching anything other than files
        filesList = filesList.filter(x => tl.stats(x).isFile());

        // Fail if no matching .sln files were found
        if (!allowEmptyWildcardMatch && (!filesList || filesList.length == 0)) {
            throw new Error('No matching files were found with search pattern: ' + pattern);
        }
    }

    if (!isWindows)
    {
        return filesList;
    }
    else
    {
        return filesList.map(file => file.split("/").join("\\"));
    }
}