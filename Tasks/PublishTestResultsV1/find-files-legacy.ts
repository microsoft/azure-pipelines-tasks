import * as path from 'path';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';
import * as taskLibInternal from 'azure-pipelines-task-lib/internal';

let globule = require('globule');

export function findFiles(pattern: string, includeDir: boolean, cwd?: string): string[];
export function findFiles(pattern: string[], includeDir: boolean, cwd?: string): string[];
export function findFiles(pattern: any, includeDir: boolean, cwd?: string): string[] {
    let patterns: string[] = [];
    let baseDir = isNullOrWhitespace(cwd) ? process.cwd() : cwd;

    tl.debug('Input pattern: ' + pattern + ' cwd: ' + baseDir);

    if (typeof pattern === 'string') {
        patterns = [pattern];
    } else if (pattern instanceof Array) {
        patterns = pattern;
    }

    let searchPattern = extractPattern(patterns, baseDir);
    let globPattern: string[] = searchPattern.includePatterns;

    searchPattern.excludePatterns.forEach(p => globPattern.push('!' + p));
    tl.debug('Glob pattern: ' + JSON.stringify(globPattern));

    let result = globule.find(globPattern);
    tl.debug('Glob result length: ' + result.length);
    if (!includeDir) {
        return result.filter(isFile);
    }

    return result;
}

// Preserve the task-lib legacy pattern rules without letting broken symlinks abort the search.
export function findWindowsFiles(pattern: string, cwd?: string): string[] {
    if (pattern.indexOf('*') < 0 && pattern.indexOf('?') < 0) {
        return [pattern];
    }

    let baseDir = isNullOrWhitespace(cwd) ? process.cwd() : cwd;
    let includePatterns: string[] = [];
    let excludePatterns: RegExp[] = [];

    pattern.replace(/;;/g, '\0').split(';').forEach(filter => {
        if (!filter) {
            return;
        }

        filter = filter.replace(/\0/g, ';');
        let exclude = filter.indexOf('-:') === 0;
        if (exclude || filter.indexOf('+:') === 0) {
            filter = filter.substr(2);
        }
        if (filter.endsWith('/') || filter.endsWith('\\')) {
            throw new Error(tl.loc('LIB_InvalidPattern', filter));
        }
        if (!path.isAbsolute(filter)) {
            filter = path.join(baseDir, filter);
            if (filter.endsWith('\\')) {
                filter = filter.substr(0, filter.length - 1);
            }
        }

        if (exclude) {
            excludePatterns.push(taskLibInternal._legacyFindFiles_convertPatternToRegExp(filter));
        } else {
            includePatterns.push(filter);
        }
    });

    let matches = new Set<string>();
    includePatterns.forEach(filter => {
        let star = filter.indexOf('*');
        let question = filter.indexOf('?');
        let wildcard = star < 0 ? question : question < 0 ? star : Math.min(star, question);
        let findPath = taskLibInternal._getDirectoryName(wildcard < 0 ? filter : filter.substr(0, wildcard));
        if (!findPath) {
            return;
        }

        let expression = taskLibInternal._legacyFindFiles_convertPatternToRegExp(filter);
        let files = tl.find(findPath, {
            allowBrokenSymbolicLinks: true,
            followSpecifiedSymbolicLink: true,
            followSymbolicLinks: true,
            skipMissingFiles: false
        });
        files.forEach(file => {
            let normalizedFile = file.replace(/\\/g, '/');
            if (!expression.test(normalizedFile) || excludePatterns.some(exclude => exclude.test(normalizedFile))) {
                return;
            }

            let stats: fs.Stats;
            try {
                stats = fs.statSync(file);
            } catch (err) {
                if (err.code !== 'ENOENT') {
                    throw err;
                }
                stats = fs.lstatSync(file);
                if (!stats.isSymbolicLink()) {
                    throw err;
                }
                tl.warning('Skipping broken symbolic link: ' + file);
                return;
            }
            if (!stats.isDirectory()) {
                matches.add(file);
            }
        });
    });

    return Array.from(matches).sort();
}

function appendCwd(filterPattern: string[], cwd: string): string[] {
    let result: string[] = [];
    filterPattern.forEach(p => result.push(path.isAbsolute(p) ? p : path.join(cwd, p)));
    return result;
}

function extractPattern(patterns: string[], cwd: string): any {
    let includePatterns: string[] = [];
    let excludePatterns: string[] = [];

    patterns.forEach(p => {
        p.split(';').forEach(inputFilter => {
            if (isNullOrWhitespace(inputFilter) || inputFilter.length < 2) {
                tl.warning('Ignoring this filter: ' + inputFilter);
            }

            switch (inputFilter.charAt(0)) {
                case '+':
                    includePatterns.push(inputFilter.substr(2));
                    break;
                case '-':
                    excludePatterns.push(inputFilter.substr(2));
                    break;
                default:
                    includePatterns.push(inputFilter);
            }
        });
    });

    tl.debug('Include patterns length: ' + includePatterns.length + ' Exclude patterns length: ' + excludePatterns.length);
    return {
        includePatterns: appendCwd(includePatterns, cwd),
        excludePatterns: appendCwd(excludePatterns, cwd)
    };
}

function isNullOrWhitespace(input) {
    if (typeof input === 'undefined' || input == null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

function isFile(path: string): boolean {
    try {
        return fs.lstatSync(path).isFile();
    } catch (err) {
        return true;
    }
}
