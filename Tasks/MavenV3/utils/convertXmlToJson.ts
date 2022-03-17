import * as xml2js from 'xml2js';
import * as tl from 'azure-pipelines-task-lib/task';

export async function convertXmlToJson(xmlContent: string) {
    tl.debug("Converting XML to JSON");
    try {
        const jsonContent = await xml2js.parseStringPromise(xmlContent)

        return jsonContent;
    }
    catch (err) {
        tl.error(`Error when conveting the xml to json: ${err}`)
        throw err
    }
}
