import { IWebAppDeploymentProvider } from './IWebAppDeploymentProvider';
import { TaskParameters } from '../taskparameters';
import { KuduServiceUtility } from 'azurermdeploycommon/operations/KuduServiceUtility';
import { AzureAppService } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service';
import { Kudu } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceUtility } from 'azurermdeploycommon/operations/AzureAppServiceUtility';
import tl = require('azure-pipelines-task-lib/task');
import * as ParameterParser from 'azurermdeploycommon/operations/ParameterParserUtility'
import { addReleaseAnnotation } from 'azurermdeploycommon/operations/ReleaseAnnotationUtility';
import { PackageUtility } from 'azurermdeploycommon/webdeployment-common/packageUtility';
import { AzureDeployPackageArtifactAlias } from 'azurermdeploycommon/Constants';
import { AzureRmEndpointAuthenticationScheme } from 'azurermdeploycommon/azure-arm-rest/constants';
import publishProfileUtility = require("utility-common-v2/publishProfileUtility");
import { AzureEndpoint } from 'azurermdeploycommon/azure-arm-rest/azureModels';

export class AzureRmWebAppDeploymentProvider implements IWebAppDeploymentProvider {
    protected taskParams:TaskParameters;
    protected appService: AzureAppService;
    protected kuduService: Kudu;
    protected appServiceUtility: AzureAppServiceUtility;
    protected kuduServiceUtility: KuduServiceUtility;
    protected virtualApplicationPath: string = "";
    protected activeDeploymentID;
    protected publishProfileScmCredentials: publishProfileUtility.ScmCredentials;
    protected isPublishProfileAuthSchemeEndpoint: boolean = false;
    protected slotName: string;

    constructor(taskParams: TaskParameters) {
        this.taskParams = taskParams;
        let packageArtifactAlias = PackageUtility.getArtifactAlias(this.taskParams.Package.getPath());
        tl.setVariable(AzureDeployPackageArtifactAlias, packageArtifactAlias);
    }

    public async PreDeploymentStep() {
        if (this.taskParams.azureEndpoint.scheme && this.taskParams.azureEndpoint.scheme.toLowerCase() === AzureRmEndpointAuthenticationScheme.PublishProfile) {
            let publishProfileEndpoint: AzureEndpoint = this.taskParams.azureEndpoint;
            this.isPublishProfileAuthSchemeEndpoint = true;
            this.publishProfileScmCredentials = await publishProfileUtility.getSCMCredentialsFromPublishProfile(publishProfileEndpoint.PublishProfile);
            this.kuduService = new Kudu(this.publishProfileScmCredentials.scmUri, this.publishProfileScmCredentials.username, this.publishProfileScmCredentials.password);
            let resourceId = publishProfileEndpoint.resourceId;
            let resourceIdSplit = resourceId.split("/");
            this.slotName = resourceIdSplit.length === 11 ? resourceIdSplit[10] : "production";
        } else {
            this.appService = new AzureAppService(this.taskParams.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName,
                this.taskParams.SlotName, this.taskParams.WebAppKind);
            this.appServiceUtility = new AzureAppServiceUtility(this.appService);
            this.kuduService = await this.appServiceUtility.getKuduService();
            this.slotName = this.appService.getSlot();
        }
        this.kuduServiceUtility = new KuduServiceUtility(this.kuduService);
    }

    public async DeployWebAppStep() {}

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if (!this.isPublishProfileAuthSchemeEndpoint) {
            await addReleaseAnnotation(this.taskParams.azureEndpoint, this.appService, isDeploymentSuccess);
        }
        if (this.kuduServiceUtility) {
            this.activeDeploymentID = await this.kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, { 'type': 'Deployment', slotName: this.slotName });
            tl.debug('Active DeploymentId :'+ this.activeDeploymentID);
        }
        
        let appServiceApplicationUrl: string;
        if (!this.isPublishProfileAuthSchemeEndpoint) {
            appServiceApplicationUrl = await this.appServiceUtility.getApplicationURL();
        } else {
            appServiceApplicationUrl = this.publishProfileScmCredentials.applicationUrl;
        }
        console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
        tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
    }

    protected async PostDeploymentStep() {
        if (!this.isPublishProfileAuthSchemeEndpoint) {
            if (this.taskParams.AppSettings) {
                var customApplicationSettings = ParameterParser.parse(this.taskParams.AppSettings);
                await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings);
            }

            if (this.taskParams.ConfigurationSettings) {
                var customApplicationSettings = ParameterParser.parse(this.taskParams.ConfigurationSettings);
                await this.appServiceUtility.updateConfigurationSettings(customApplicationSettings);
            }

            await this.appServiceUtility.updateScmTypeAndConfigurationDetails();
        }
    }
}