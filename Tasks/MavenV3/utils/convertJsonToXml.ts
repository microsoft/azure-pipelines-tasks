import * as tl from 'azure-pipelines-task-lib/task';
import * as xml2js from 'xml2js';

export function convertJsonToXml(jsonContent: any, builderOpts: any) {
    tl.debug("Converting JSON to XML")
    try {
        const builder = new xml2js.Builder(...builderOpts);
        const xmlContent = builder.buildObject(jsonContent).replace(/&#xD;/g, "");

        return xmlContent
    }
    catch (err) {
        tl.error(`Error when converting the json to the xml: ${err}`)
        throw err
    }
}
