import { TaskParameters } from './taskparameters';
import { KuduServiceUtility } from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/KuduServiceUtility';
import { AzureAppService } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azure-arm-app-service';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azure-arm-endpoint';
import { Kudu } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceUtility } from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/AzureAppServiceUtility';
import { AzureEndpoint } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azureModels';
import { AzureResourceFilterUtility } from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/AzureResourceFilterUtility';
import tl = require('azure-pipelines-task-lib/task');
import { addReleaseAnnotation } from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/ReleaseAnnotationUtility';
import { ContainerBasedDeploymentUtility } from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/ContainerBasedDeploymentUtility';
import * as ParameterParser from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/ParameterParserUtility';

export class AzureRmWebAppDeploymentProvider{
    protected taskParams:TaskParameters;
    protected appService: AzureAppService;
    protected kuduService: Kudu;
    protected appServiceUtility: AzureAppServiceUtility;
    protected kuduServiceUtility: KuduServiceUtility;
    protected activeDeploymentID: string;

    constructor(taskParams: TaskParameters) {
        this.taskParams = taskParams;
    }

    public async PreDeploymentStep() {
        this.appService = new AzureAppService(this.taskParams.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName, this.taskParams.SlotName);
        this.appServiceUtility = new AzureAppServiceUtility(this.appService);

        this.kuduService = await this.appServiceUtility.getKuduService();
        this.kuduServiceUtility = new KuduServiceUtility(this.kuduService);
        tl.debug(`Resource Group: ${this.taskParams.ResourceGroupName}`);
        tl.debug(`is Linux container web app: ${this.taskParams.isLinuxContainerApp}`);
    }

    public async DeployWebAppStep() {
        tl.debug("Performing container based deployment.");

        if(this.taskParams.AppSettings) {
            var customApplicationSettings = ParameterParser.parse(this.taskParams.AppSettings);
            await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings);
        }

        if(!this.taskParams["StartupCommand"]) {
            this.taskParams["StartupCommand"] = null;
        }

        let containerDeploymentUtility: ContainerBasedDeploymentUtility = new ContainerBasedDeploymentUtility(this.appService);
        await containerDeploymentUtility.deployWebAppImage(this.taskParams);
        await this.appServiceUtility.updateScmTypeAndConfigurationDetails();
    }

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            await addReleaseAnnotation(this.taskParams.azureEndpoint, this.appService, isDeploymentSuccess);
            this.activeDeploymentID = await this.kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, {'type': 'Deployment', slotName: this.appService.getSlot()});
            tl.debug('Active DeploymentId :'+ this.activeDeploymentID);
        }
        
        let appServiceApplicationUrl: string = await this.appServiceUtility.getApplicationURL();
        console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
        tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
    }
}