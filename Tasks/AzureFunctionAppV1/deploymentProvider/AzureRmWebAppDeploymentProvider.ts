import { IWebAppDeploymentProvider } from './IWebAppDeploymentProvider';
import { TaskParameters } from '../taskparameters';
import { KuduServiceUtility } from 'azurermdeploycommon/operations/KuduServiceUtility';
import { AzureAppService } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service';
import { Kudu } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceUtility } from 'azurermdeploycommon/operations/AzureAppServiceUtility';
import tl = require('vsts-task-lib/task');
import * as ParameterParser from 'azurermdeploycommon/operations/ParameterParserUtility'
import { addReleaseAnnotation } from 'azurermdeploycommon/operations/ReleaseAnnotationUtility';

export class AzureRmWebAppDeploymentProvider implements IWebAppDeploymentProvider {
    protected taskParams:TaskParameters;
    protected appService: AzureAppService;
    protected kuduService: Kudu;
    protected appServiceUtility: AzureAppServiceUtility;
    protected kuduServiceUtility: KuduServiceUtility;
    protected virtualApplicationPath: string = "";
    protected activeDeploymentID;

    constructor(taskParams: TaskParameters) {
        this.taskParams = taskParams;
    }

    public async PreDeploymentStep() {
        this.appService = new AzureAppService(this.taskParams.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName, 
            this.taskParams.SlotName, this.taskParams.WebAppKind);
        this.appServiceUtility = new AzureAppServiceUtility(this.appService);

        this.kuduService = await this.appServiceUtility.getKuduService();
        this.kuduServiceUtility = new KuduServiceUtility(this.kuduService);
    }

    public async DeployWebAppStep() {}

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        await addReleaseAnnotation(this.taskParams.azureEndpoint, this.appService, isDeploymentSuccess);
        if(this.kuduServiceUtility) {
            this.activeDeploymentID = await this.kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, {'type': 'Deployment', slotName: this.appService.getSlot()});
            tl.debug('Active DeploymentId :'+ this.activeDeploymentID);
        }
        
        let appServiceApplicationUrl: string = await this.appServiceUtility.getApplicationURL();
        console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
        tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
    }

    protected async PostDeploymentStep() {
        if(this.taskParams.AppSettings) {
            var customApplicationSettings = ParameterParser.parse(this.taskParams.AppSettings);
            await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings);
        }

        if(this.taskParams.ConfigurationSettings) {
            var customApplicationSettings = ParameterParser.parse(this.taskParams.ConfigurationSettings);
            await this.appServiceUtility.updateConfigurationSettings(customApplicationSettings);
        }

        await this.appServiceUtility.updateScmTypeAndConfigurationDetails();
    }
}