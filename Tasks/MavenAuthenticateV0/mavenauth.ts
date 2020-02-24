import tl = require('azure-pipelines-task-lib/task');
import util = require('./mavenutils');

import * as path from 'path';
import { emitTelemetry } from 'artifacts-common/telemetry';

const M2FolderName: string = ".m2";
const SettingsXmlName: string = "settings.xml";

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function run(): Promise<void> {
    let internalFeedServerElements: any[] = [];
    let externalServiceEndpointsServerElements: any[] = [];
    try {
        internalFeedServerElements = util.getInternalFeedsServerElements("artifactsFeeds");
        externalServiceEndpointsServerElements = util.getExternalServiceEndpointsServerElements("mavenServiceConnections");
        const newServerElements = internalFeedServerElements.concat(externalServiceEndpointsServerElements);

        if(newServerElements.length === 0) {
            tl.warning(tl.loc("Warning_NoEndpointsToAuth"));
            return;
        }

        let userM2FolderPath: string = "";

        if (tl.osType().match(/^Win/)) {
            userM2FolderPath = path.join(process.env.USERPROFILE, M2FolderName);
        } else {
            userM2FolderPath = path.join(process.env.HOME, M2FolderName);
        }

        if (!tl.exist(userM2FolderPath)) {
            tl.debug(tl.loc("Info_M2FolderDoesntExist", userM2FolderPath));
            tl.mkdirP(userM2FolderPath);
        }

        let userSettingsXmlPath: string = path.join(userM2FolderPath, SettingsXmlName);
        let settingsJson: any;

        if(tl.exist(userSettingsXmlPath)) {
            tl.debug(tl.loc("Info_SettingsXmlRead", userSettingsXmlPath));
            settingsJson = await util.readXmlFileAsJson(userSettingsXmlPath)
        }
        else {
            tl.debug(tl.loc("Info_CreatingSettingsXml", userSettingsXmlPath));
        }

        for (let serverElement of newServerElements) {
            settingsJson = util.addRepositoryEntryToSettingsJson(settingsJson, serverElement);
        };

        tl.debug(tl.loc("Info_WritingToSettingsXml"));
        await util.jsonToXmlConverter(userSettingsXmlPath, settingsJson);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
    finally {
        emitTelemetry("Packaging", "MavenAuthenticate", {
            "InternalFeedAuthCount": internalFeedServerElements.length,
            "ExternalRepoAuthCount": externalServiceEndpointsServerElements.length
        });
    }
}

run();