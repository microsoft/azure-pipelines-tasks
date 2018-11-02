import { TaskParameters } from './taskparameters';
import { KuduServiceUtility } from 'azurermdeploycommon/operations/KuduServiceUtility';
import { AzureAppService } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service';
import { AzureRMEndpoint } from 'azurermdeploycommon/azure-arm-rest/azure-arm-endpoint';
import { Kudu } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service-kudu';
import { AzureEndpoint } from 'azurermdeploycommon/azure-arm-rest/azureModels';
import { AzureAppServiceUtility } from 'azurermdeploycommon/operations/AzureAppServiceUtility';
import { AzureResourceFilterUtility } from 'azurermdeploycommon/operations/AzureResourceFilterUtility';
import tl = require('vsts-task-lib/task');
import * as ParameterParser from 'azurermdeploycommon/operations/ParameterParserUtility'
import { addReleaseAnnotation } from 'azurermdeploycommon/operations/ReleaseAnnotationUtility';
import { ContainerBasedDeploymentUtility } from 'azurermdeploycommon/operations/ContainerBasedDeploymentUtility';
const linuxFunctionStorageSetting: string = '-WEBSITES_ENABLE_APP_SERVICE_STORAGE false';

export class AzureFunctionOnContainerDeploymentProvider{
    protected taskParams:TaskParameters;
    protected appService: AzureAppService;
    protected kuduService: Kudu;
    protected appServiceUtility: AzureAppServiceUtility;
    protected kuduServiceUtility: KuduServiceUtility;
    protected azureEndpoint: AzureEndpoint;
    protected activeDeploymentID;

    constructor(taskParams: TaskParameters) {
        this.taskParams = taskParams;
    }

    public async PreDeploymentStep() {
        this.azureEndpoint = await new AzureRMEndpoint(this.taskParams.connectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', this.taskParams.WebAppName));
        
        if(!this.taskParams.DeployToSlotOrASEFlag){
            var appDetails = await AzureResourceFilterUtility.getAppDetails(this.azureEndpoint, this.taskParams.WebAppName);
            this.taskParams.ResourceGroupName = appDetails["resourceGroupName"];
        }

        this.appService = new AzureAppService(this.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName, this.taskParams.SlotName);
        this.appServiceUtility = new AzureAppServiceUtility(this.appService);

        this.kuduService = await this.appServiceUtility.getKuduService();
        this.kuduServiceUtility = new KuduServiceUtility(this.kuduService);
    }

    public async DeployWebAppStep() {
        tl.debug("Performing container based deployment.");

        var customApplicationSetting = ParameterParser.parse(linuxFunctionStorageSetting);
        await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);

        let containerDeploymentUtility: ContainerBasedDeploymentUtility = new ContainerBasedDeploymentUtility(this.appService);
        await containerDeploymentUtility.deployWebAppImage(this.taskParams);
        
        await this.appServiceUtility.updateScmTypeAndConfigurationDetails();
    }

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            await addReleaseAnnotation(this.azureEndpoint, this.appService, isDeploymentSuccess);
            this.activeDeploymentID = await this.kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, {'type': 'Deployment', slotName: this.appService.getSlot()});
            tl.debug('Active DeploymentId :'+ this.activeDeploymentID);
        }

        let appServiceApplicationUrl: string = await this.appServiceUtility.getApplicationURL();
        console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
        tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
    }
}