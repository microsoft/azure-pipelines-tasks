import * as path from 'path';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';

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

    let searchPattern = extractPattern(patterns);
    let globOptions = { nocase: process.platform === 'win32' };
    let result: string[] = [];

    searchPattern.includePatterns.forEach(p => {
        let literalPath = getExistingPath(p, baseDir);
        result = result.concat(literalPath ? [literalPath] : findGlobMatches(p, baseDir, globOptions));
    });

    searchPattern.excludePatterns.forEach(p => {
        let literalPath = getExistingPath(p, baseDir);
        if (literalPath) {
            result = result.filter(file => !pathsEqual(file, literalPath));
        } else {
            result = result.filter(file => !matchesPattern(p, file, baseDir, globOptions));
        }
    });

    result = result.filter((file, index) => result.indexOf(file) === index);
    tl.debug('Glob result length: ' + result.length);
    if (!includeDir) {
        return result.filter(isFile);
    }

    return result;
}

function extractPattern(patterns: string[]): any {
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
        includePatterns: includePatterns,
        excludePatterns: excludePatterns
    };
}

function findGlobMatches(pattern: string, cwd: string, options: any): string[] {
    let searchLocation = getSearchLocation(pattern, cwd);
    return searchLocation.pattern ?
        globule.find(searchLocation.pattern, { cwd: searchLocation.directory, prefixBase: true, nocase: options.nocase }) :
        [];
}

function matchesPattern(pattern: string, filePath: string, cwd: string, options: any): boolean {
    let searchLocation = getSearchLocation(pattern, cwd);
    let matchPath = path.relative(searchLocation.directory, filePath);

    return globule.isMatch(
        searchLocation.pattern,
        normalizePath(matchPath),
        options);
}

function getSearchLocation(pattern: string, cwd: string): { directory: string; pattern: string } {
    let isAbsolute = path.isAbsolute(pattern);
    let root = isAbsolute ? path.parse(pattern).root : '';
    let searchDirectory = isAbsolute ? root : cwd;
    let segments = normalizePath(isAbsolute ? pattern.substr(root.length) : pattern)
        .split('/')
        .filter(segment => segment.length > 0);
    let segmentIndex = 0;

    while (segmentIndex < segments.length) {
        let segment = segments[segmentIndex];
        if (segment === '.') {
            segmentIndex++;
            continue;
        }

        try {
            let candidate = path.resolve(searchDirectory, segment);
            if (!fs.statSync(candidate).isDirectory()) {
                break;
            }
            searchDirectory = candidate;
            segmentIndex++;
        } catch (err) {
            break;
        }
    }

    return {
        directory: searchDirectory,
        pattern: segments.slice(segmentIndex).join('/')
    };
}

function getExistingPath(pattern: string, cwd: string): string {
    let filePath = path.isAbsolute(pattern) ? pattern : path.resolve(cwd, pattern);
    return fs.existsSync(filePath) ? normalizePath(filePath) : null;
}

function normalizePath(filePath: string): string {
    return filePath.replace(/[\\/]/g, '/');
}

function pathsEqual(left: string, right: string): boolean {
    return process.platform === 'win32' ?
        left.toLowerCase() === right.toLowerCase() :
        left === right;
}

function isNullOrWhitespace(input) {
    if (typeof input === 'undefined' || input == null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

function isFile(path: string): boolean {
    try {
        return fs.statSync(path).isFile();
    } catch (err) {
        return true;
    }
}
