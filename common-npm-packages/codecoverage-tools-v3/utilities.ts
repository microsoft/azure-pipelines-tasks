
import * as Q from "q";
import * as fs from "fs";
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from "path";
import * as xml2js from "xml2js";
import * as fse from "fs-extra";
import * as cheerio from "cheerio";

let stripbom = require("strip-bom");

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export interface GetOrCreateResult<T> {
    created: boolean;
    result: T;
}

// returns a substring that is common from first. For example, for "abcd" and "abdf", "ab" is returned.
export function sharedSubString(string1: string, string2: string): string {
    let ret = "";
    let index = 1;
    while (string1.substring(0, index) === string2.substring(0, index)) {
        ret = string1.substring(0, index);
        index++;
    }
    return ret;
}

// sorts string array in ascending order
export function sortStringArray(list): string[] {
    let sortedFiles: string[] = list.sort((a, b) => {
        if (a > b) {
            return 1;
        } else if (a < b) {
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
export function isNullOrWhitespace(input) {
    if (typeof input === "undefined" || input == null) {
        return true;
    }
    return input.replace(/\s/g, "").length < 1;
}

// returns empty string if the given value is undefined or null.
export function trimToEmptyString(input) {
    if (typeof input === "undefined" || input == null) {
        return "";
    }
    return input.trim();
}

// appends given text to file.
export function appendTextToFileSync(filePath: string, fileContent: string) {
    if (isFileExists(filePath)) {
        fs.appendFileSync(filePath, fileContent);
    } else {
        throw new Error(tl.loc("FileNotFound", filePath));
    }
}

// prepends given text to start of file.
export function prependTextToFileSync(filePath: string, fileContent: string) {
    if (isFileExists(filePath)) {
        let data = fs.readFileSync(filePath); // read existing contents into data
        let fd = fs.openSync(filePath, "w+");
        let buffer = new Buffer(fileContent);
        fs.writeSync(fd, buffer, 0, buffer.length, 0); // write new data
        fs.writeSync(fd, data, 0, data.length, 0); // append old data
        fs.close(fd, (err) => {
            if (err) {
                tl.error(err.message);
            }
        });
    }
}

// single utility for appending text and prepending text to file.
export function insertTextToFileSync(filePath: string, prependFileContent?: string, appendFileContent?: string) {
    if (isFileExists(filePath) && (prependFileContent || appendFileContent)) {
        let existingData = fs.readFileSync(filePath); // read existing contents into data
        let fd = fs.openSync(filePath, "w+");
        let preTextLength = prependFileContent ? prependFileContent.length : 0;

        if (prependFileContent) {
            let prependBuffer = new Buffer(prependFileContent);
            fs.writeSync(fd, prependBuffer, 0, prependBuffer.length, 0); // write new data
        }
        fs.writeSync(fd, existingData, 0, existingData.length, preTextLength); // append old data
        if (appendFileContent) {
            let appendBuffer = new Buffer(appendFileContent);
            fs.writeSync(fd, appendBuffer, 0, appendBuffer.length, existingData.length + preTextLength);
        }
        fs.close(fd, (err) => {
            if (err) {
                tl.error(err.message);
            }
        });
    }
}

// trim the given character if it exists in the end of string.
export function trimEnd(data: string, trimChar: string) {
    if (!trimChar || !data) {
        return data;
    }

    if (data.endsWith(trimChar)) {
        return data.substring(0, data.length - trimChar.length);
    } else {
        return data;
    }
}

export function readXmlFileAsJson(filePath: string): Q.Promise<any> {
    tl.debug("Reading XML file: " + filePath);
    return readFile(filePath, "utf-8")
        .then(convertXmlStringToJson);
}

export function readFile(filePath: string, encoding: string): Q.Promise<string> {
    return Q.nfcall<string>(fs.readFile, filePath, encoding);
}

export function convertXmlStringToJson(xmlContent: string): Q.Promise<any> {
    tl.debug("Converting XML file to JSON");
    return Q.nfcall<any>(xml2js.parseString, stripbom(xmlContent));
}

export function writeJsonAsXmlFile(filePath: string, jsonContent: any): Q.Promise<void> {
    let builder = new xml2js.Builder();
    tl.debug("Writing JSON as XML file: " + filePath);
    let xml = builder.buildObject(jsonContent);
    xml = xml.replace(/&#xD;/g, "");
    return writeFile(filePath, xml);
}

export function writeFile(filePath: string, fileContent: string): Q.Promise<void> {
    tl.debug("Creating dir if not exists: " + path.dirname(filePath));
    fse.mkdirpSync(path.dirname(filePath));
    tl.debug("Check dir: " + fs.existsSync(path.dirname(filePath)));
    return Q.nfcall<void>(fs.writeFile, filePath, fileContent, { encoding: "utf-8" });
}

export function addPropToJson(obj: any, propName: string, value: any): void {
    tl.debug("Adding property to JSON: " + propName);
    if (typeof obj === "undefined") {
        obj = {};
    }

    if (obj instanceof Array) {
        let propNode = obj.find(o => o[propName]);
        if (propNode) {
            obj = propNode;
        }
    }

    if (propName in obj) {
        if (obj[propName] instanceof Array) {
            obj[propName].push(value);
        } else if (typeof obj[propName] !== "object") {
            obj[propName] = [obj[propName], value];
        }
    } else if (obj instanceof Array) {
        let prop = {};
        prop[propName] = value;
        obj.push(prop);
    } else {
        obj[propName] = value;
    }
}

export function readXmlFileAsDom(filePath: string): CheerioStatic {
    tl.debug("Reading XML file: " + filePath);
    return cheerio.load(stripbom(fs.readFileSync(filePath, "utf-8")), <CheerioOptionsInterface>{ xmlMode: true, withDomLvl1: false });
}