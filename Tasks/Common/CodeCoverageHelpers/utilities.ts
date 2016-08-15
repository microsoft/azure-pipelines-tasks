/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/string.d.ts" />
/// <reference path="../../../definitions/node.d.ts" />
/// <reference path="../../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../../definitions/shelljs.d.ts" />
/// <reference path="../../../definitions/xml2js.d.ts" />

import * as Q from 'q';
import * as fs from 'fs';
import * as tl from 'vsts-task-lib/task'
import * as shell from 'shelljs';
import * as path from 'path';
import * as str from 'string';
import * as xml2js from 'xml2js';

export interface GetOrCreateResult<T> {
    created: boolean;
    result: T;
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
        return 0;
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

export function readXmlFileAsJson(filePath: string): Q.Promise<string> {
    return readFile(filePath, 'utf-8')
        .then(convertXmlStringToJson);
}

export function readFile(filePath: string, encoding: string): Q.Promise<string> {
    return Q.nfcall<string>(fs.readFile, filePath, encoding);
}

export function convertXmlStringToJson(xmlContent: string): Q.Promise<string> {
    return Q.nfcall<string>(xml2js.parseString, xmlContent);
}

export function writeJsonAsXmlFile(jsonContent: string): Q.Promise<void> {
    let builder = new xml2js.Builder();
    let xml = builder.buildObject(jsonContent);
    return writeFile(xml);
}

export function writeFile(fileContent: string): Q.Promise<void> {
    return Q.nfcall<void>(fs.writeFile, fileContent);
}

