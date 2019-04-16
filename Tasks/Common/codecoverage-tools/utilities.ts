import * as tl from 'vsts-task-lib/task';
import * as xml2js from 'xml2js';
import { readFile } from 'fs';

// returns a substring that is common from first. For example, for "abcd" and "abdf", "ab" is returned.
export function sharedSubString(string1: string, string2: string): string {
    let ret = '';
    let index = 1;
    while (string1.substring(0, index) === string2.substring(0, index)) {
        ret = string1.substring(0, index);
        index++;
    }
    return ret;
}

// returns true if path exists and it is a directory else false.
export function isDirectoryExists(path: string): boolean {
    try {
        return tl.stats(path).isDirectory();
    } catch (error) {
        return false;
    }
}

// returns true if path exists and it is a file else false.
export function isFileExists(path: string): boolean {
    try {
        return tl.stats(path).isFile();
    } catch (error) {
        return false;
    }
}

// returns true if given string is null or whitespace.
export function isNullOrWhitespace(input: any) {
    if (typeof input === 'undefined' || input == null) {
        return true;
    }
    return input.replace(/\s/g, '').length < 1;
}

// returns empty string if the given value is undefined or null.
export function trimToEmptyString(input: any) {
    if (typeof input === 'undefined' || input == null) {
        return '';
    }
    return input.trim();
}

export async function readXmlFileAsJson(filePath: string): Promise<any> {
    tl.debug('Reading XML file: ' + filePath);
    return readFile(filePath, { encoding: 'utf-8' }, function (err: any, data: any) {
        xml2js.parseString(data, function (err: any, result: any) {
            return result;
        });
    });
}