import tl = require('azure-pipelines-task-lib/task');
import util = require('./gradleutils');

import * as path from 'path';
import { emitTelemetry } from 'azure-pipelines-tasks-artifacts-common/telemetry';

import { getFederatedWorkloadIdentityCredentials, getFeedTenantId } from "azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils";

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

        const entraWifServiceConnectionName = tl.getInput("workloadIdentityServiceConnection");
        const feedIdNames = tl.getDelimitedInput("artifactsFeeds", ',');

        if (entraWifServiceConnectionName) {

            if (feedIdNames.length === 0) {
                tl.warning(tl.loc("Warning_NoEndpointsToAuth"));
            }
            
            tl.debug(tl.loc("Info_AddingFederatedFeedAuth", entraWifServiceConnectionName));
            let token = await getFederatedWorkloadIdentityCredentials(entraWifServiceConnectionName);
            
            if (token) {

                for (let feedName of feedIdNames) {
                    const credential = {
                        id: feedName,
                        username: entraWifServiceConnectionName,
                        password: token
                    };
    
                    propertiesContent = util.addCredentialToGradleProperties(propertiesContent, credential);
                    federatedFeedAuthSuccessCount++;
                    console.log(tl.loc("Info_SuccessAddingFederatedFeedAuth", feedName));
                }

                tl.debug(tl.loc("Info_WritingToGradleProperties"));
                util.writeGradlePropertiesFile(userGradlePropertiesPath, propertiesContent);

            }
            else {
                tl.warning(tl.loc("Warning_TokenNotGenerated"));
            }
            return;
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
