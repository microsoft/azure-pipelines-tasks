// TODO: This file should be moved to the common package as a spotbugs tool
import * as xml2js from 'xml2js';
import * as tl from 'azure-pipelines-task-lib/task';

/**
 * Converts the xml content to the json format
 * @param xmlContent - xml content, which will be converted
 * @returns the json schema object
 */
export async function convertXmlToJson(xmlContent: string): Promise<any> {
    tl.debug("Converting XML to JSON");
    try {
        const jsonContent = await xml2js.parseStringPromise(xmlContent);

        return jsonContent;
    }
    catch (err) {
        tl.error(`Error when conveting the xml to json: ${err}`);
        throw err;
    }
}
