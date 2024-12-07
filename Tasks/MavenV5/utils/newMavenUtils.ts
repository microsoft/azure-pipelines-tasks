// TODO: This file should be moved to the common package as a spotbugs tool
import * as tl from 'azure-pipelines-task-lib/task';
import { convertXmlToJson } from './convertXmlToJson';
import { readFile, writeFile } from './fileUtils';
import { convertJsonToXml } from './convertJsonToXml';
import { removeBom } from './removeBom';

/**
 * Reads the xml file and converts it to the json format
 * @param filePath Path to the xml file
 * @returns Json schema of the file content
 */
export async function readXmlFileAsJson(filePath: string): Promise<any> {
    try {
        const xml = await readFile(filePath);
        const fixedXml = removeBom(xml);
        const json = await convertXmlToJson(fixedXml);

        return json;
    } catch (err) {
        tl.error(`Error when reading xml file as json: ${err}`);
        throw err;
    }
}

/**
 * Converts the json content to the xml format and writes it to the file
 * @param filePath Path to the file to be written
 * @param jsonContent Json content to write
 * @param rootName Refers to: https://github.com/Leonidas-from-XIV/node-xml2js#options-for-the-builder-class
 */
export function writeJsonAsXmlFile(filePath: string, jsonContent: any, rootName?: string): void {
    tl.debug('Writing JSON as XML file: ' + filePath);
    try {
        const builderOpts = {
            renderOpts: {
                pretty: true
            },
            headless: true,
            rootName: rootName ?? 'root'
        };
        const xml = convertJsonToXml(jsonContent, builderOpts);
        return writeFile(filePath, xml);
    } catch (err) {
        tl.error(`Error when writing the json to the xml file: ${err}`);
        throw err;
    }
}
