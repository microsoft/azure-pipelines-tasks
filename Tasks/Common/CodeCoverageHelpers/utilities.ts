/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/string.d.ts" />
/// <reference path="../../../definitions/node.d.ts" />
/// <reference path="../../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../../definitions/shelljs.d.ts" />

import * as Q from 'q';
import * as fs from 'fs';
import * as tl from 'vsts-task-lib/task'
import * as shell from 'shelljs';
import * as path from 'path';
import * as str from 'string';

export interface GetOrCreateResult<T> {
    created: boolean;
    result: T;
}

//converts inputString to titleCase string. For example, "abc def" is converted to "Abc Def"
export function toTitleCase(inputString: string): string {
    if (inputString) {
        return inputString.replace(/\w\S*/g, function(str) { return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase(); });
    }
    return inputString;
}

// returns a substring that is common from first. For example, for "abcd" and "abdf", "ab" is returned.
export function sharedSubString(string1: string, string2: string): string {
    var ret = "";
    var index = 1;
    while (string1.substring(0, index) == string2.substring(0, index)) {
        ret = string1.substring(0, index);
        index++;
    }
    return ret;
}

// sorts string array in ascending order
export function sortStringArray(list): string[] {
    var sortedFiles: string[] = list.sort((a, b) => {
        if (a > b) {
            return 1;
        }
        else if (a < b) {
            return -1;
        }
        else {
            return 0;
        }
    });
    return sortedFiles;
}

// returns true if path exists and it is a directory else false.
export function isDirectoryExists(path: string): boolean {
    try {
        return tl.stats(path).isDirectory();
    }
    catch (error) {
        return false;
    }
}

// returns true if path exists and it is a file else false.
export function isFileExists(path: string): boolean {
    try {
        return tl.stats(path).isFile();
    }
    catch (error) {
        return false;
    }
}

export function readFileContents(filePath: string, encoding: string): Q.Promise<string> {
    var defer = Q.defer<string>();

    fs.readFile(filePath, encoding, (err, data) => {
        if (err) {
            defer.reject(new Error('Could not read file (' + filePath + '): ' + err.message));
        }
        else {
            defer.resolve(data);
        }
    });

    return defer.promise;
}

export function fileExists(filePath: string): Q.Promise<boolean> {
    var defer = Q.defer<boolean>();

    fs.exists(filePath, (exists) => {
        defer.resolve(exists);
    });

    return <Q.Promise<boolean>>defer.promise;
}
export function objectToFile(filePath: string, obj: any): Q.Promise<void> {
    var defer = Q.defer<void>();

    fs.writeFile(filePath, JSON.stringify(obj, null, 2), (err) => {
        if (err) {
            defer.reject(new Error('Could not save to file (' + filePath + '): ' + err.message));
        }
        else {
            defer.resolve(null);
        }
    });

    return defer.promise;
}

export function objectFromFile(filePath: string, defObj?: any): Q.Promise<any> {
    var defer = Q.defer<any>();

    fs.exists(filePath, (exists) => {
        if (!exists && defObj) {
            defer.resolve(defObj);
        }
        else if (!exists) {
            defer.reject(new Error('File does not exist: ' + filePath));
        }
        else {
            fs.readFile(filePath, (err, contents) => {
                if (err) {
                    defer.reject(new Error('Could not read file (' + filePath + '): ' + err.message));
                }
                else {
                    var obj: any = JSON.parse(contents.toString());
                    defer.resolve(obj);
                }
            });
        }
    })

    return defer.promise;
}

export function getOrCreateObjectFromFile<T>(filePath: string, defObj: T): Q.Promise<GetOrCreateResult<T>> {
    var defer = Q.defer<GetOrCreateResult<T>>();

    fs.exists(filePath, (exists) => {
        if (!exists) {
            fs.writeFile(filePath, JSON.stringify(defObj, null, 2), (err) => {
                if (err) {
                    defer.reject(new Error('Could not save to file (' + filePath + '): ' + err.message));
                }
                else {
                    defer.resolve({
                        created: true,
                        result: defObj
                    });
                }
            });
        }
        else {
            fs.readFile(filePath, (err, contents) => {
                if (err) {
                    defer.reject(new Error('Could not read file (' + filePath + '): ' + err.message));
                }
                else {
                    var obj: any = JSON.parse(contents.toString());
                    defer.resolve({
                        created: false,
                        result: obj
                    });
                }
            });
        }
    })

    return defer.promise;
}

// ret is { output: string, code: number }
export function exec(cmdLine: string): Q.Promise<any> {
    var defer = Q.defer<any>();

    shell.exec(cmdLine, (code, output) => {
        defer.resolve({ code: code, output: output });
    });

    return defer.promise;
}

export enum SearchOption {
    TopDirectoryOnly = 0,
    AllDirectories = 1,
}

// returns true if given string is null or whitespace.
export function isNullOrWhitespace(input) {
    if (typeof input == 'undefined' || input == null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

// returns empty string if the given value is undefined or null.
export function trimToEmptyString(input) {
    if (typeof input == 'undefined' || input == null) {
        return "";
    }
    return input.trim();
}

// appends given text to file.
export function appendTextToFileSync(filePath: string, fileContent: string) {
    if (isFileExists(filePath)) {
        fs.appendFileSync(filePath, fileContent);
    }
}

// prepends given text to start of file.
export function prependTextToFileSync(filePath: string, fileContent: string) {
    if (isFileExists(filePath)) {
        var data = fs.readFileSync(filePath); //read existing contents into data
        var fd = fs.openSync(filePath, 'w+');
        var buffer = new Buffer(fileContent);
        fs.writeSync(fd, buffer, 0, buffer.length, 0); //write new data
        fs.writeSync(fd, data, 0, data.length, 0); //append old data
        fs.close(fd);
    }
}

// single utility for appending text and prepending text to file.
export function insertTextToFileSync(filePath: string, prependFileContent?: string, appendFileContent?: string) {
    if (isFileExists(filePath) && (prependFileContent || appendFileContent)) {
        var existingData = fs.readFileSync(filePath); //read existing contents into data
        var fd = fs.openSync(filePath, 'w+');
        var preTextLength = prependFileContent ? prependFileContent.length : 0;

        if (prependFileContent) {
            var prependBuffer = new Buffer(prependFileContent);
            fs.writeSync(fd, prependBuffer, 0, prependBuffer.length, 0); //write new data
        }
        fs.writeSync(fd, existingData, 0, existingData.length, preTextLength); //append old data
        if (appendFileContent) {
            var appendBuffer = new Buffer(appendFileContent);
            fs.writeSync(fd, appendBuffer, 0, appendBuffer.length, existingData.length + preTextLength);
        }
        fs.close(fd);
    }
}

// trim the given character if it exists in the end of string.
export function trimEnd(data: string, trimChar: string) {
    if (!trimChar || !data) {
        return data;
    }

    if (str(data).endsWith(trimChar)) {
        return data.substring(0, data.length - trimChar.length);
    } else {
        return data;
    }
}