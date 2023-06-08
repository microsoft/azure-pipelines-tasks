import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');
var parseString = require('xml2js').parseString;
import { AzureAppService } from './azure-arm-app-service';
import { Kudu } from './azure-arm-app-service-kudu';
import webClient = require('./webClient');

export class AzureAppServiceUtility {

    private readonly _appService: AzureAppService;
    private readonly _telemetryFeature: string;

    constructor(appService: AzureAppService, telemetryFeature?: string) {
        this._appService = appService;
        this._telemetryFeature = telemetryFeature || "AzureAppServiceDeployment"; //TODO modify telemetry.publish command so that agent automatically pass task name and version to the server then remove this parameter
    }

    public async getWebDeployPublishingProfile(): Promise<any> {
        var publishingProfile = await this._appService.getPublishingProfileWithSecrets();
        var defer = Q.defer<any>();
        parseString(publishingProfile, (error, result) => {
            if (!!error) {
                defer.reject(error);
            }
            var publishProfile = result && result.publishData && result.publishData.publishProfile ? result.publishData.publishProfile : null;
            if (publishProfile) {
                for (var index in publishProfile) {
                    if (publishProfile[index].$ && publishProfile[index].$.publishMethod === "MSDeploy") {
                        defer.resolve(result.publishData.publishProfile[index].$);
                    }
                }
            }

            defer.reject(tl.loc('ErrorNoSuchDeployingMethodExists'));
        });

        return defer.promise;
    }

    public async getApplicationURL(virtualApplication?: string): Promise<string> {
        let webDeployProfile: any =  await this.getWebDeployPublishingProfile();
        return await webDeployProfile.destinationAppUrl + ( virtualApplication ? "/" + virtualApplication : "" );
    }

    public async pingApplication(): Promise<void> {
        try {
            var applicationUrl: string = await this.getApplicationURL();

            if (!applicationUrl) {
                tl.debug('Application Url not found.');
                return;
            }
            var webRequest = new webClient.WebRequest();
            webRequest.method = 'GET';
            webRequest.uri = applicationUrl;
            let webRequestOptions:webClient.WebRequestOptions = {retriableErrorCodes: [], retriableStatusCodes: [], retryCount: 1, retryIntervalInSeconds: 5, retryRequestTimedout: true};
            var response = await webClient.sendRequest(webRequest, webRequestOptions);
            tl.debug(`App Service status Code: '${response.statusCode}'. Status Message: '${response.statusMessage}'`);
        }
        catch(error) {
            tl.debug(`Unable to ping App Service. Error: ${error}`);
        }
    }

    public async getPhysicalPath(virtualApplication: string): Promise<string> {
        if (!virtualApplication) {
            return '/site/wwwroot';
        }

        virtualApplication = (virtualApplication.startsWith("/")) ? virtualApplication.substring(1) : virtualApplication;

        // construct URL depending on virtualApplication or root of webapplication
        var physicalPath = null;
        var virtualPath = "/" + virtualApplication;
        var appConfigSettings = await this._appService.getConfiguration();
        var virtualApplicationMappings = appConfigSettings.properties && appConfigSettings.properties.virtualApplications;

        if (virtualApplicationMappings) {
            for( var mapping of virtualApplicationMappings ) {
                if (mapping.virtualPath.toLowerCase() == virtualPath.toLowerCase()) {
                    physicalPath = mapping.physicalPath;
                    break;
                }
            }
        }

        var physicalToVirtualPathMap =  physicalPath
            ? { 'virtualPath': virtualPath, 'physicalPath': physicalPath }
            : null;

        if (!physicalToVirtualPathMap) {
            throw Error(tl.loc("VirtualApplicationDoesNotExist", virtualApplication));
        }

        tl.debug(`Virtual Application Map: Physical path: '${physicalToVirtualPathMap.physicalPath}'. Virtual path: '${physicalToVirtualPathMap.virtualPath}'.`);
        return physicalToVirtualPathMap.physicalPath;
    }

    public async getKuduService(): Promise<Kudu> {

        const publishingCredentials = await this._appService.getPublishingCredentials();
        const scmUri = publishingCredentials.properties["scmUri"];

        if (!scmUri) {
            throw Error(tl.loc('KuduSCMDetailsAreEmpty'));
        }

        const authHeader = await this.getKuduAuthHeader(publishingCredentials);
        return new Kudu(publishingCredentials.properties["scmUri"], authHeader);
    }

    private async getKuduAuthHeader(publishingCredentials: any): Promise<string> {
        const scmPolicyCheck = await this.isSitePublishingCredentialsEnabled();

        let token = "";
        let method = "";

        const password = publishingCredentials.properties["publishingPassword"];

        if (scmPolicyCheck === false) {
            token = await this._appService._client.getCredentials().getToken();
            method = "Bearer";
            // Though bearer AuthN is used, lets try to set publish profile password for mask hints to maintain compat with old behavior for MSDEPLOY.
            // This needs to be cleaned up once MSDEPLOY suppport is removed. Safe handle the exception setting up mask hint as we dont want to fail here.
            try {
                tl.setVariable(`AZURE_APP_MSDEPLOY_${this._appService.getSlot()}_PASSWORD`, password, true);
            }
            catch (error) {
                // safe handle the exception setting up mask hint
                tl.debug(`Setting mask hint for publish profile password failed with error: ${error}`);
            }
        } else {
            tl.setVariable(`AZURE_APP_SERVICE_KUDU_${this._appService.getSlot()}_PASSWORD`, password, true);
            const userName = publishingCredentials.properties["publishingUserName"];
            const buffer = Buffer.from(userName + ':' + password);
            token = buffer.toString('base64');
            method = "Basic";
        }

        const authMethodtelemetry = {
            authMethod: method
        };
        tl.debug(`Using ${method} authentication method for Kudu service.`);
        console.log(`##vso[telemetry.publish area=TaskDeploymentMethod;feature=${this._telemetryFeature}]${JSON.stringify(authMethodtelemetry)}`);

        return method + " " + token;
    }

    public async updateAndMonitorAppSettings(addProperties?: any, deleteProperties?: any, formatJSON?: boolean, perSlot: boolean = true): Promise<boolean> {
        if (formatJSON) {
            var appSettingsProperties = {};
            for(var property in addProperties) {
                appSettingsProperties[addProperties[property].name] = addProperties[property].value;
            }

            if (!!addProperties) {
                console.log(tl.loc('UpdatingAppServiceApplicationSettings', JSON.stringify(appSettingsProperties)));
            }

            if (!!deleteProperties) {
                console.log(tl.loc('DeletingAppServiceApplicationSettings', JSON.stringify(Object.keys(deleteProperties))));
            }

            var isNewValueUpdated: boolean = await this._appService.patchApplicationSettings(appSettingsProperties, deleteProperties, true);
        }
        else {
            for(var property in addProperties) {
                if (!!addProperties[property] && addProperties[property].value !== undefined) {
                    addProperties[property] = addProperties[property].value;
                }
            }

            if (!!addProperties) {
                console.log(tl.loc('UpdatingAppServiceApplicationSettings', JSON.stringify(addProperties)));
            }

            if (!!deleteProperties) {
                console.log(tl.loc('DeletingAppServiceApplicationSettings', JSON.stringify(Object.keys(deleteProperties))));
            }

            var isNewValueUpdated: boolean = await this._appService.patchApplicationSettings(addProperties, deleteProperties);
        }

        if (!!isNewValueUpdated) {
            console.log(tl.loc('UpdatedAppServiceApplicationSettings'));
        }
        else {
            console.log(tl.loc('AppServiceApplicationSettingsAlreadyPresent'));
        }

        if (perSlot) {
            await this._appService.patchApplicationSettingsSlot(addProperties);
        }
        return isNewValueUpdated;
    }

    public async enableRenameLockedFiles(): Promise<void> {
        try {
            var webAppSettings = await this._appService.getApplicationSettings();
            if (webAppSettings && webAppSettings.properties) {
                if (webAppSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES !== '1') {
                    tl.debug(`Rename locked files value found to be ${webAppSettings.properties.MSDEPLOY_RENAME_LOCKED_FILES}. Updating the value to 1`);
                    await this.updateAndMonitorAppSettings({ 'MSDEPLOY_RENAME_LOCKED_FILES' : '1' });
                    console.log(tl.loc('RenameLockedFilesEnabled'));
                }
                else {
                    tl.debug('Rename locked files is already enabled in App Service');
                }
            }
        }
        catch(error) {
            throw new Error(tl.loc('FailedToEnableRenameLockedFiles', error));
        }
    }

    public async updateStartupCommandAndRuntimeStack(runtimeStack: string, startupCommand?: string): Promise<void> {
        var configDetails = await this._appService.getConfiguration();
        var appCommandLine: string = configDetails.properties.appCommandLine;
        startupCommand = (!!startupCommand) ? startupCommand : appCommandLine;
        var linuxFxVersion: string = configDetails.properties.linuxFxVersion;
        runtimeStack = (!!runtimeStack) ? runtimeStack : linuxFxVersion;

        if (startupCommand != appCommandLine || runtimeStack != linuxFxVersion) {
            var properties = { linuxFxVersion: runtimeStack, appCommandLine: startupCommand };
            for(var property in properties) {
                if (!!properties[property] && properties[property].value !== undefined) {
                    properties[property] = properties[property].value;
                }
            }

            console.log(tl.loc('UpdatingAppServiceConfigurationSettings', JSON.stringify(properties)));
            await this._appService.patchConfiguration({'properties': properties});
            console.log(tl.loc('UpdatedAppServiceConfigurationSettings'));
        }
        else {
            tl.debug(`Skipped updating the values. linuxFxVersion: ${linuxFxVersion} : appCommandLine: ${appCommandLine}`)
        }
    }

    public async isSitePublishingCredentialsEnabled(): Promise<boolean> {
        try {
            let scmAuthPolicy: any = await this._appService.getSitePublishingCredentialPolicies();
            tl.debug(`Site Publishing Policy check: ${JSON.stringify(scmAuthPolicy)}`);
            if (scmAuthPolicy && scmAuthPolicy.properties.allow) {
                tl.debug("Function App does allow SCM access");
                return true;
            }
            else {
                tl.debug("Function App does not allow SCM Access");
                return false;
            }
        }
        catch(error) {
            tl.debug(`Call to get SCM Policy check failed: ${error}`);
            return false;
        }
    }

    public async isFunctionAppOnCentauri(): Promise<boolean> {
        try {
            let details: any =  await this._appService.get();
            if (details.properties["managedEnvironmentId"]) {
                tl.debug("Function Container app is on Centauri.");
                return true;
            }
            else {
                return false;
            }
        }
        catch(error) {
            tl.debug(`Skipping Centauri check: ${error}`);
            return false;
        }
    }
}
