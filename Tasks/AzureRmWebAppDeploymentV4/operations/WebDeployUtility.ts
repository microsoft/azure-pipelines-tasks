import tl = require('azure-pipelines-task-lib/task');

import { TaskParameters } from './TaskParameters';
import { WebDeployArguments, WebDeployResult } from 'azure-pipelines-tasks-webdeployment-common/msdeployutility';
import {  executeWebDeploy } from 'azure-pipelines-tasks-webdeployment-common/deployusingmsdeploy';
import { copySetParamFileIfItExists } from 'azure-pipelines-tasks-webdeployment-common/utility';
import { AzureAppServiceUtility } from './AzureAppServiceUtility';
import { shouldUseMSDeployTokenAuth } from 'azure-pipelines-tasks-webdeployment-common/msdeployutility'

const DEFAULT_RETRY_COUNT = 3;

export class WebDeployUtility {

    private readonly _azureAppServiceUtility: AzureAppServiceUtility;

    constructor(azureAppServiceUtility: AzureAppServiceUtility) {
        this._azureAppServiceUtility = azureAppServiceUtility;
    }

    public async publishUsingWebDeploy(taskParameters: TaskParameters) {
        const webDeployArguments = await this.constructWebDeployArguments(taskParameters);
        const retryCountParam = tl.getVariable("appservice.msdeployretrycount");
        let retryCount = (retryCountParam && !isNaN(Number(retryCountParam))) ? Number(retryCountParam) : DEFAULT_RETRY_COUNT;
        let webDeployResult: WebDeployResult;

        while (retryCount > 0) {
            webDeployResult = await executeWebDeploy(webDeployArguments);
            if (!webDeployResult.isSuccess) {
                await this.webDeployRecommendationForIssue(taskParameters, webDeployResult.errorCode, false);
            }
            else {
                break;
            }

            retryCount--;
        }

        if (webDeployArguments.setParametersFile) {
            try {
                tl.rmRF(webDeployArguments.setParametersFile);
            }
            catch(error) {
                tl.debug('unable to delete setparams file: ');
                tl.debug(error);
            }
        }

        if (!webDeployResult.isSuccess) {
            await this.webDeployRecommendationForIssue(taskParameters, webDeployResult.errorCode, true);
            throw new Error(webDeployResult.error);
        }
    }

    private async constructWebDeployArguments(taskParameters: TaskParameters): Promise<WebDeployArguments> {
        const publishProfile = await this._azureAppServiceUtility.getWebDeployPublishingProfile();
        const webDeployArguments = {} as WebDeployArguments;

        if (await this._azureAppServiceUtility.isSitePublishingCredentialsEnabled()) {
            tl.debug("Using Basic authentication.");
            webDeployArguments.authType = "Basic";
            webDeployArguments.userName = publishProfile.userName;
            webDeployArguments.password = publishProfile.userPWD;
        }
        else if (shouldUseMSDeployTokenAuth()) {
            tl.debug("Basic authentication is disabled, using token based authentication.");
            webDeployArguments.authType = "Bearer";
            webDeployArguments.password = await this._azureAppServiceUtility.getAuthToken();
            webDeployArguments.userName = "user"; // arbitrary but not empty
        }
        else {
            throw new Error(tl.loc("BasicAuthNotSupported"));
        } 

        webDeployArguments.publishUrl = publishProfile.publishUrl;
        webDeployArguments.package = taskParameters.Package;
        webDeployArguments.additionalArguments = taskParameters.AdditionalArguments;
        webDeployArguments.appName = taskParameters.WebAppName;
        webDeployArguments.excludeFilesFromAppDataFlag = taskParameters.ExcludeFilesFromAppDataFlag;
        webDeployArguments.removeAdditionalFilesFlag = taskParameters.RemoveAdditionalFilesFlag;
        webDeployArguments.takeAppOfflineFlag = taskParameters.TakeAppOfflineFlag;
        webDeployArguments.useWebDeploy = taskParameters.UseWebDeploy;
        webDeployArguments.virtualApplication = taskParameters.VirtualApplication;
        
        const setParametersFile = copySetParamFileIfItExists(taskParameters.SetParametersFile);
        if (setParametersFile) {
            webDeployArguments.setParametersFile = setParametersFile.slice(setParametersFile.lastIndexOf('\\') + 1, setParametersFile.length);
        }

        return webDeployArguments;
    }

    private async webDeployRecommendationForIssue(taskParameters: TaskParameters, errorCode: string, isRecommendation: boolean) {
        switch(errorCode) {
            case 'ERROR_CONNECTION_TERMINATED': {
                if(!isRecommendation) {
                    await this._azureAppServiceUtility.pingApplication();
                }
                break;
            }
            case 'ERROR_INSUFFICIENT_ACCESS_TO_SITE_FOLDER': {
                tl.warning(tl.loc("Trytodeploywebappagainwithappofflineoptionselected"));
                break;
            }
            case 'WebJobsInProgressIssue': {
                tl.warning(tl.loc('WebJobsInProgressIssue'));
                break;
            }
            case 'FILE_IN_USE': {
                if(!isRecommendation && taskParameters.RenameFilesFlag) {
                    await this._azureAppServiceUtility.enableRenameLockedFiles();
                }
                else {
                    tl.warning(tl.loc("Trytodeploywebappagainwithrenamefileoptionselected"));
                    tl.warning(tl.loc("RunFromZipPreventsFileInUseError"));
                }
                break;
            }
            case 'transport connection': {
                tl.warning(tl.loc("Updatemachinetoenablesecuretlsprotocol"));
                break;
            }
            case 'ERROR_CERTIFICATE_VALIDATION_FAILED': {
                if(isRecommendation) {
                    tl.warning(tl.loc('ASE_WebDeploySSLIssueRecommendation'));
                }
                break;
            }
            default:
                break;
        }
    }
}