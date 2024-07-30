import tl = require('azure-pipelines-task-lib/task');
import Q = require('q');
var webCommonUtility = require('azure-pipelines-tasks-webdeployment-common/utility');
var zipUtility = require('azure-pipelines-tasks-webdeployment-common/ziputility');
var azureStorage = require('azure-storage');
import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service';
import { AzureAppServiceUtility } from 'azure-pipelines-tasks-azure-arm-rest/azureAppServiceUtility';
import { applyTransformations } from 'azure-pipelines-tasks-webdeployment-common/fileTransformationsUtility';
import { sleepFor } from 'azure-pipelines-tasks-azure-arm-rest/webClient';
import { PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import * as ParameterParser from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility';
import { AzureAppServiceUtilityExt } from '../operations/AzureAppServiceUtilityExt';
import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu';
import { KuduServiceUtility } from '../operations/KuduServiceUtility';

export class FlexConsumptionWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider {

    public async PreDeploymentStep() {
        this.appService = new AzureAppService(this.taskParams.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName,
        this.taskParams.SlotName, this.taskParams.WebAppKind);
        this.appServiceUtility = new AzureAppServiceUtility(this.appService, "AzureFunctionAppDeployment");
        this.appServiceUtilityExt = new AzureAppServiceUtilityExt(this.appService);
        this.kuduService = await this.appServiceUtility.getKuduService();
        this.kuduServiceUtility = new KuduServiceUtility(this.kuduService);
    }

    public async DeployWebAppStep() {
        let deploymentMethodtelemetry = '{"deploymentMethod":" Deployment for Flex Consumption"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureFunctionAppDeployment]" + deploymentMethodtelemetry);
        // The Task Parms DeploymentType is not used in this deployment provider
        if(this.taskParams.DeploymentType != null){
            console.log(tl.loc('DeploymentTypeNotSupportedForFlexConsumption'));
        }
        let userDefinedAppSettings = this._getUserDefinedAppSettings();
        var webPackage = await applyTransformations(this.taskParams.Package.getPath(), this.taskParams.WebConfigParameters, this.taskParams.Package.getPackageType());
        if(tl.stats(webPackage).isDirectory()) {
            let tempPackagePath = webCommonUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
            webPackage = await zipUtility.archiveFolder(webPackage, "", tempPackagePath);
            tl.debug("Compressed folder into zip " +  webPackage);
        }
        // constructing Query Parameters

        var remoteBuild = "false";

        let queryParameters:Array<string> = [
            'remoteBuild=' + remoteBuild,
            'deployer=' + 'VSTS_FUNCTIONS_V2'
        ];

        tl.debug("Initiated deployment via kudu service for functionapp package : ");
        await this.kuduServiceUtility.oneDeployFlex(webPackage, queryParameters);
        await this.PostDeploymentStep();
    }


    private _getUserDefinedAppSettings() {
        let userDefinedAppSettings = {};
        if(this.taskParams.AppSettings) {
            var customApplicationSettings = ParameterParser.parse(this.taskParams.AppSettings);
            for(var property in customApplicationSettings) {
                if(!!customApplicationSettings[property] && customApplicationSettings[property].value !== undefined) {
                    userDefinedAppSettings[property] = customApplicationSettings[property].value;
                }
            }
        }

        return userDefinedAppSettings;
    }
}

