import path = require('path');
import fs = require('fs');

import * as tl from 'azure-pipelines-task-lib/task';

import * as xml2js from 'xml2js';
import * as fse from 'fs-extra';

export async function readFile(filePath: string, encoding: string) {

    tl.debug('Reading file at path ' + filePath)

    return new Promise<string>((resolve, reject) =>
        fs.readFile(filePath, (err, buffer) => {
            const fileData = buffer.toString(encoding)
            console.dir({ fileData }, { depth: Infinity, colors: true })
            resolve(fileData)
        })
    )
}

function fixEncoding(str: string) {
    if (str.charCodeAt(0) === 0xFEFF) {
        return str.slice(1);
    }
    return str;
}

export async function convertXmlStringToJson(xmlContent: string) {
    tl.debug("Converting XML file to JSON");
    const fixedXml = fixEncoding(xmlContent)
    try {
        const json = await xml2js.parseStringPromise(fixedXml)

        return json;
    }
    catch (err) {
        tl.error("Error when conveting the xml to json: " + err)
        throw err
    }
}

export async function readXmlFileAsJson(filePath: string): Promise<any> {
    tl.debug("Reading XML file from: " + filePath);
    try {
        const xml = await readFile(filePath, "utf-8")
        tl.debug('file was readed successfully')
        console.log('xml: ' + xml)
        const json = await convertXmlStringToJson(xml)
        tl.debug('json: ' + JSON.stringify(json))
        return json
    }
    catch (err) {
        tl.error('Error when reading xml file: ' + err)
        throw err
    }
}


export function writeJsonAsXmlFile(filePath: string, jsonContent: any) {
    try {
        const builder = new xml2js.Builder();
        tl.debug("Writing JSON as XML file: " + filePath);
        console.dir({ jsonContent }, { depth: Infinity, colors: true })
        let xml = builder.buildObject(jsonContent);
        console.log('Builded xml: ', xml)
        xml = xml.replace(/&#xD;/g, "");
        console.log('Final xml: ', xml)
        writeFile(filePath, xml);
    }
    catch (err) {
        tl.error('Error when writing the json to the xml file:' + err)
        throw new Error(err)
    }
}

export function writeFile(filePath: string, fileContent: string) {
    try {

        tl.debug("Creating dir if not exists: " + path.dirname(filePath));
        fse.mkdirpSync(path.dirname(filePath));
        tl.debug("Check dir: " + fs.existsSync(path.dirname(filePath)));
        fs.writeFileSync(filePath, fileContent, { encoding: "utf-8" });
    }
    catch (err) {
        tl.error('Error when writing to the file:' + err)
        throw new Error(err)
    }
}

// rewrite onto the persistence version
export function addPropToJson(obj: any, propName: string, value: any): void {
    tl.debug("Adding property to JSON: " + propName);
    console.dir({ obj }, { depth: Infinity, colors: true })
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
