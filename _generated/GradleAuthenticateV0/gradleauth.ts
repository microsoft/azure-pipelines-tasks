import tl = require('azure-pipelines-task-lib/task');
import util = require('./gradleutils');

import * as path from 'path';
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';


const GradleFolderName: string = ".gradle";
const GradlePropertiesName: string = "gradle.properties";
const backupGradlePropertiesName: string = "_gradle.properties";

tl.setResourcePath(path.join(__dirname, 'task.json'));

async function run(): Promise<void> {
    let internalFeedCredentials: any[] = [];
    let externalServiceEndpointsCredentials: any[] = [];
    let federatedFeedAuthSuccessCount: number = 0;
    try {
        let userGradleFolderPath: string = "";

        if (tl.osType().match(/^Win/)) {
            userGradleFolderPath = path.join(process.env.USERPROFILE, GradleFolderName);
        } else {
            userGradleFolderPath = path.join(process.env.HOME, GradleFolderName);
        }

        if (!tl.exist(userGradleFolderPath)) {
            tl.debug(tl.loc("Info_GradleUserHomeFolderDoesntExist", userGradleFolderPath));
            tl.mkdirP(userGradleFolderPath);
        }

        let userGradlePropertiesPath: string = path.join(userGradleFolderPath, GradlePropertiesName);
        let backupGradlePropertiesPath: string = path.join(userGradleFolderPath, backupGradlePropertiesName);
        let propertiesContent: string = "";
        
        tl.setTaskVariable('userGradlePropertiesPath', userGradlePropertiesPath);

        if (tl.exist(userGradlePropertiesPath)) {
            tl.debug(tl.loc("Info_GradlePropertiesRead", userGradlePropertiesPath));
            if (!tl.getVariable('FIRST_RUN_GRADLE_PROPERTIES_EXISTS_PATH') && !tl.exist(backupGradlePropertiesPath)) {
                tl.cp(userGradlePropertiesPath, backupGradlePropertiesPath);
                tl.setTaskVariable("backupUserGradlePropertiesFilePath", backupGradlePropertiesPath);
            }
            propertiesContent = util.readGradlePropertiesFile(userGradlePropertiesPath);
        }
        else {
            tl.debug(tl.loc("Info_CreatingGradleProperties", userGradlePropertiesPath));
            tl.setVariable('FIRST_RUN_GRADLE_PROPERTIES_EXISTS_PATH', userGradlePropertiesPath);
        }


        internalFeedCredentials = util.getInternalFeedsCredentials("artifactsFeeds");
        externalServiceEndpointsCredentials = util.getExternalServiceEndpointsCredentials("gradleServiceConnections");
        const newCredentials = internalFeedCredentials.concat(externalServiceEndpointsCredentials);

        if(newCredentials.length === 0) {
            tl.warning(tl.loc("Warning_NoEndpointsToAuth"));
            return;
        }

        for (let credential of newCredentials) {
            propertiesContent = util.addCredentialToGradleProperties(propertiesContent, credential);
        };

        tl.debug(tl.loc("Info_WritingToGradleProperties"));
        util.writeGradlePropertiesFile(userGradlePropertiesPath, propertiesContent);
    }
    catch (err) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
    finally {
        emitTelemetry("Packaging", "GradleAuthenticate", {
            "InternalFeedAuthCount": internalFeedCredentials.length,
            "ExternalRepoAuthCount": externalServiceEndpointsCredentials.length,
            "FederatedFeedAuthCount": federatedFeedAuthSuccessCount
        });
    }
}

run();
