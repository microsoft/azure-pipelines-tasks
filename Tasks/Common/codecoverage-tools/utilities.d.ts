/// <reference path="../../../definitions/Q.d.ts" />
/// <reference path="../../../definitions/string.d.ts" />
/// <reference path="../../../definitions/xml2js.d.ts" />
/// <reference path="../../../definitions/vsts-task-lib.d.ts" />
/// <reference path="../../../definitions/node.d.ts" />
import * as Q from "q";
export interface GetOrCreateResult<T> {
    created: boolean;
    result: T;
}
export declare function sharedSubString(string1: string, string2: string): string;
export declare function sortStringArray(list: any): string[];
export declare function isDirectoryExists(path: string): boolean;
export declare function isFileExists(path: string): boolean;
export declare function isNullOrWhitespace(input: any): boolean;
export declare function trimToEmptyString(input: any): any;
export declare function appendTextToFileSync(filePath: string, fileContent: string): void;
export declare function prependTextToFileSync(filePath: string, fileContent: string): void;
export declare function insertTextToFileSync(filePath: string, prependFileContent?: string, appendFileContent?: string): void;
export declare function trimEnd(data: string, trimChar: string): string;
export declare function readXmlFileAsJson(filePath: string): Q.Promise<any>;
export declare function readFile(filePath: string, encoding: string): Q.Promise<string>;
export declare function convertXmlStringToJson(xmlContent: string): Q.Promise<any>;
export declare function convertXmlStringToJsonSync(xmlContent: string): any;
export declare function writeJsonAsXmlFile(filePath: string, jsonContent: any): Q.Promise<void>;
export declare function writeFile(filePath: string, fileContent: string): Q.Promise<void>;
export declare function addPropToJson(obj: any, propName: string, value: any): void;
