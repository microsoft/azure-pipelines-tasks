import tl = require('azure-pipelines-task-lib/task');
import util = require('./mavenutil');

import * as path from 'path';

const M2FolderName: string = ".m2";
const SettingsXmlName: string = "settings.xml";
const accessTokenEnvSetting: string = 'ENV_MAVEN_ACCESS_TOKEN';

async function run(): Promise<void> {
    try {
        const feeds: string[] = tl.getDelimitedInput("feed", ",", true);

        let userM2FolderPath: string = "";

        if (tl.osType().match(/^Win/)) {
            userM2FolderPath = path.join(process.env.USERPROFILE, M2FolderName);
        } else {
            userM2FolderPath = path.join(process.env.HOME, M2FolderName);
        }

        if (!tl.exist(userM2FolderPath)) {
            tl.debug(".m2 folder does not exist, creating: " + userM2FolderPath);
            tl.mkdirP(userM2FolderPath);
        }

        tl.debug("Found the current user's .m2 folder: " + userM2FolderPath);

        let userSettingsXmlPath: string = path.join(userM2FolderPath, SettingsXmlName);
        let settingsJson: any;

        if(tl.exist(userSettingsXmlPath)) {
            tl.debug("User already has a settings.xml.");
            settingsJson = await util.readXmlFileAsJson(userSettingsXmlPath)
        }

        for (let feed of feeds) {
            let serverJson:any = {
                id: feed,
                configuration: {
                    httpHeaders: {
                        property: {
                            name: 'Authorization',
                            value: 'Basic ${env.' + accessTokenEnvSetting + '}'
                        }
                    }
                }
            };

            settingsJson =  util.mavenSettingsJsonInsertServer(settingsJson, serverJson);
        };
        await util.writeJsonAsSettingsFile(userSettingsXmlPath, settingsJson);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run();