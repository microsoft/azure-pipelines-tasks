import tl = require('azure-pipelines-task-lib/task');
import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service';
import webClient = require('azure-pipelines-tasks-azure-arm-rest-v2/webClient');
var parseString = require('xml2js').parseString;
import Q = require('q');
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service-kudu';

export class AzureAppServiceUtils {
    private _appService: AzureAppService;
    constructor(appService: AzureAppService) {
        this._appService = appService;
    }

    public async monitorApplicationState(state: string): Promise<void> {
        state = state.toLowerCase();
        if(["running", "stopped"].indexOf(state) == -1) {
            throw new Error(tl.loc('InvalidMonitorAppState', state));
        }

        while(true) {
            var appDetails = await this._appService.get(true);
            if(appDetails && appDetails.properties && appDetails.properties["state"]) {
                tl.debug(`App Service state: ${appDetails.properties["state"]}`)
                if(appDetails.properties["state"].toLowerCase() == state) {
                    tl.debug(`App Service state '${appDetails.properties["state"]}' matched with expected state '${state}'.`);
                    console.log(tl.loc('AppServiceState', appDetails.properties["state"]));
                    break;
                }
                await webClient.sleepFor(5);
            }
            else {
                tl.debug('Unable to monitor app service details as the state is unknown.');
                break;
            }
        }
    }

    public async getWebDeployPublishingProfile(): Promise<any> {
        var publishingProfile = await this._appService.getPublishingProfileWithSecrets();
        var defer = Q.defer<any>();
        parseString(publishingProfile, (error, result) => {
            for (var index in result.publishData.publishProfile) {
                if (result.publishData.publishProfile[index].$.publishMethod === "MSDeploy") {
                    defer.resolve(result.publishData.publishProfile[index].$);
                }
            }
            defer.reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
        });

        return defer.promise;
    }

    public async pingApplication(): Promise<void> {
        try {
            var applicationUrl: string = (await this.getWebDeployPublishingProfile()).destinationAppUrl;

            if(!applicationUrl) {
                tl.debug('Application Url not found.');
                return;
            }
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'GET';
            webRequest.uri = applicationUrl;
            let webRequestOptions: webClient.WebRequestOptions = {retriableErrorCodes: [], retriableStatusCodes: [], retryCount: 1, retryIntervalInSeconds: 5, retryRequestTimedout: true};
            var response = await webClient.sendRequest(webRequest, webRequestOptions);
            tl.debug(`App Service status Code: '${response.statusCode}'. Status Message: '${response.statusMessage}'`);
        }
        catch(error) {
            tl.debug(`Unable to ping App Service. Error: ${error}`);
        }
    }

    public async getKuduService(): Promise<Kudu> {
        var publishingCredentials = await this._appService.getPublishingCredentials();
        if(publishingCredentials.properties["scmUri"]) {
            tl.setVariable(`AZURE_APP_SERVICE_KUDU_${this._appService.getSlot()}_PASSWORD`, publishingCredentials.properties["publishingPassword"], true);
            return new Kudu(publishingCredentials.properties["scmUri"], publishingCredentials.properties["publishingUserName"], publishingCredentials.properties["publishingPassword"]);
        }

        throw Error(tl.loc('KuduSCMDetailsAreEmpty'));
    }
}