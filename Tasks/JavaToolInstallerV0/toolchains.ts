import fs = require('fs');
import os = require('os');
import path = require('path');
import taskLib = require('azure-pipelines-task-lib/task');
import toolLib = require('azure-pipelines-tool-lib/tool');
import { create as xmlCreate } from 'xmlbuilder2';

const M2_DIR = '.m2';
const MVN_TOOLCHAINS_FILE: string = 'toolchains.xml';

export async function configureToolchains(version: string, vendor: string, jdkHome: string) {
    const id = `${vendor}_${version}`;
    const settingsDirectory = path.join(os.homedir(), M2_DIR);

    await createToolchainsSettings(
        version,
        vendor,
        id,
        jdkHome,
        settingsDirectory,
    );
}

async function createToolchainsSettings(
    version: string,
    vendor: string,
    id: string,
    jdkHome: string,
    settingsDirectory: string,
) {
    toolLib.debug(`Creating ${MVN_TOOLCHAINS_FILE} for JDK version ${version} from ${vendor}`);
    await taskLib.mkdirP(settingsDirectory);
    const originalToolchains = await readExisting(settingsDirectory);
    const updatedToolchains = generate(originalToolchains, version, vendor, id, jdkHome);
    await write(settingsDirectory, updatedToolchains, true);
}

function generate(
    original: string,
    version: string,
    vendor: string,
    id: string,
    jdkHome: string
) {
    let xmlObj;
    if (original && original.length > 0) {
        xmlObj = xmlCreate(original)
            .root()
            .ele({
                type: 'jdk',
                provides: {
                    version: `${version}`,
                    vendor: `${vendor}`,
                    id: `${id}`
                },
                configuration: {
                    jdkHome: `${jdkHome}`
                }
            });
    } else
        xmlObj = xmlCreate({
            toolchains: {
                '@xmlns': 'https://maven.apache.org/TOOLCHAINS/1.1.0',
                '@xmlns:xsi': 'https://www.w3.org/2001/XMLSchema-instance',
                '@xsi:schemaLocation':
                    'https://maven.apache.org/TOOLCHAINS/1.1.0 https://maven.apache.org/xsd/toolchains-1.1.0.xsd',
                toolchain: [
                    {
                        type: 'jdk',
                        provides: {
                            version: `${version}`,
                            vendor: `${vendor}`,
                            id: `${id}`
                        },
                        configuration: {
                            jdkHome: `${jdkHome}`
                        }
                    }
                ]
            }
        });

    return xmlObj.end({
        format: 'xml',
        wellFormed: false,
        headless: false,
        prettyPrint: true,
        width: 80
    });
}

async function readExisting(directory: string) {
    const location = path.join(directory, MVN_TOOLCHAINS_FILE);
    if (fs.existsSync(location)) {
        return fs.readFileSync(location, {
            encoding: 'utf-8',
            flag: 'r'
        });
    }
    return '';
}

async function write(directory: string, settings: string, overwriteSettings: boolean) {
    const location = path.join(directory, MVN_TOOLCHAINS_FILE);
    const settingsExists = fs.existsSync(location);
    if (settingsExists && overwriteSettings) {
        toolLib.debug(`Overwriting existing file ${location}`);
    } else if (!settingsExists) {
        toolLib.debug(`Writing to ${location}`);
    } else {
        toolLib.debug(
            `Skipping generation ${location} because file already exists and overwriting is not required`
        );
        return;
    }

    return fs.writeFileSync(location, settings, {
        encoding: 'utf-8',
        flag: 'w'
    });
}