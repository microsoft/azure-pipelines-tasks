import * as tl from 'azure-pipelines-task-lib/task';
import { convertXmlToJson } from './convertXmlToJson';
import { readFile, writeFile } from './fileUtils';
import { convertJsonToXml } from './convertJsonToXml';
import { removeBom } from './removeBom';

export async function readXmlFileAsJson(filePath: string): Promise<any> {
    try {
        const xml = await readFile(filePath, "utf-8")
        const fixedXml = removeBom(xml)
        const json = await convertXmlToJson(fixedXml)

        return json
    }
    catch (err) {
        tl.error(`Error when reading xml file as json: ${err}`)
        throw err
    }
}

export function writeJsonAsXmlFile(filePath: string, jsonContent: any, rootName?: string) {
    tl.debug("Writing JSON as XML file: " + filePath);
    try {
        const builderOpts = {
            renderOpts: {
                pretty: true,
            },
            headless: true,
            rootName: rootName
        }
        const xml = convertJsonToXml(jsonContent, builderOpts);
        return writeFile(filePath, xml);
    }
    catch (err) {
        tl.error(`Error when writing the json to the xml file: ${err}`)
        throw err
    }
}
