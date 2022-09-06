// TODO: This file should be moved to the common package as a spotbugs tool
import * as tl from 'azure-pipelines-task-lib/task';
import * as xml2js from 'xml2js';

/**
 * Convert the json content to the xml format
 * @param jsonContent - Json content, which will be converted
 * @param builderOpts - options for the bulder(converter) to the xml. See here the options: https://github.com/Leonidas-from-XIV/node-xml2js#options-for-the-builder-class
 * @returns string with the xml
 */
export function convertJsonToXml(jsonContent: any, builderOpts: any): string {
    tl.debug("Converting JSON to XML")
    try {
        const builder = new xml2js.Builder(builderOpts);
        const xmlContent = builder.buildObject(jsonContent).replace(/&#xD;/g, "");

        return xmlContent;
    }
    catch (err) {
        tl.error(`Error when converting the json to the xml: ${err}`)
        throw err;
    }
}
