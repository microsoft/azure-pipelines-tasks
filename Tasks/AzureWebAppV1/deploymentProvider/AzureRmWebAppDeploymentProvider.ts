import tl = require('azure-pipelines-task-lib/task');
import publishProfileUtility = require("azure-pipelines-tasks-utility-common/publishProfileUtility");
import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service';
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-app-service-kudu';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import { AzureAppServiceUtility } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureAppServiceUtility';
import { AzureRmEndpointAuthenticationScheme, AzureDeployPackageArtifactAlias } from 'azure-pipelines-tasks-azure-arm-rest-v2/constants';
import { PackageUtility } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import * as ParameterParser from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility'
import { TaskParameters } from '../taskparameters';
import { AzureAppServiceUtilityExt } from '../operations/AzureAppServiceUtilityExt';
import { KuduServiceUtility } from '../operations/KuduServiceUtility';
import { addReleaseAnnotation } from '../operations/ReleaseAnnotationUtility';
import { IWebAppDeploymentProvider } from './IWebAppDeploymentProvider';

export class AzureRmWebAppDeploymentProvider implements IWebAppDeploymentProvider {
    protected taskParams:TaskParameters;
    protected appService: AzureAppService;
    protected kuduService: Kudu;
    protected appServiceUtility: AzureAppServiceUtility;
    protected appServiceUtilityExt: AzureAppServiceUtilityExt;
    protected kuduServiceUtility: KuduServiceUtility;
    protected virtualApplicationPath: string = "";
    protected activeDeploymentID;
    protected publishProfileScmCredentials: publishProfileUtility.ScmCredentials;
    protected slotName: string;

    constructor(taskParams: TaskParameters) {
        this.taskParams = taskParams;
        let packageArtifactAlias = PackageUtility.getArtifactAlias(this.taskParams.Package.getPath());
        tl.setVariable(AzureDeployPackageArtifactAlias, packageArtifactAlias);
    }

    public async PreDeploymentStep() {
        if (this.taskParams.azureEndpoint.scheme && this.taskParams.azureEndpoint.scheme.toLowerCase() === AzureRmEndpointAuthenticationScheme.PublishProfile) {
            let publishProfileEndpoint: AzureEndpoint = this.taskParams.azureEndpoint;
            this.publishProfileScmCredentials = await publishProfileUtility.getSCMCredentialsFromPublishProfile(publishProfileEndpoint.PublishProfile);
            
            const buffer =  new Buffer(this.publishProfileScmCredentials.username + ':' + this.publishProfileScmCredentials.password);
            const auth = buffer.toString("base64");
            var authHeader = "Basic " + auth;

            tl.debug("Kudu: using basic authentication for publish profile");    
            console.log('##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureAppServiceDeployment]{"authMethod":"Basic"}');
            
            this.kuduService = new Kudu(this.publishProfileScmCredentials.scmUri, authHeader);
            let resourceId = publishProfileEndpoint.resourceId;
            let resourceIdSplit = resourceId.split("/");
            this.slotName = resourceIdSplit.length === 11 ? resourceIdSplit[10] : "production";
        } else {
            this.appService = new AzureAppService(this.taskParams.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName,
                this.taskParams.SlotName, this.taskParams.WebAppKind);
            this.appServiceUtility = new AzureAppServiceUtility(this.appService);
            this.appServiceUtilityExt = new AzureAppServiceUtilityExt(this.appService);
            this.kuduService = await this.appServiceUtility.getKuduService();
            this.slotName = this.appService.getSlot();
        }
        this.kuduServiceUtility = new KuduServiceUtility(this.kuduService);
    }


    public async DeployWebAppStep() {}

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(!!this.appService) {
            await addReleaseAnnotation(this.taskParams.azureEndpoint, this.appService, isDeploymentSuccess);
        }

        if(!!this.kuduServiceUtility) {
            this.activeDeploymentID = await this.kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, {'type': 'Deployment', slotName: this.slotName});
            tl.debug('Active DeploymentId :'+ this.activeDeploymentID);
        }

        let appServiceApplicationUrl: string;
        if (!!this.appServiceUtility) {
            appServiceApplicationUrl = await this.appServiceUtility.getApplicationURL();
        } else {
            appServiceApplicationUrl = this.publishProfileScmCredentials.applicationUrl;
        }
        console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
        tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
    }

    protected async PostDeploymentStep() {
        if (!!this.appServiceUtility) {
            if(this.taskParams.AppSettings) {
                var customApplicationSettings = ParameterParser.parse(this.taskParams.AppSettings);
                await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings);
            }

            if(this.taskParams.ConfigurationSettings) {
                var customConfigurationSettings = ParameterParser.parse(this.taskParams.ConfigurationSettings);
                await this.appService.updateConfigurationSettings(customConfigurationSettings);
            }

            await this.appServiceUtilityExt.updateScmTypeAndConfigurationDetails();
        }
    }
}