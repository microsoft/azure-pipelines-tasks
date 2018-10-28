import { TaskParameters } from './operations/TaskParameters';
import { KuduServiceUtility } from './operations/KuduServiceUtility';
import { AzureAppService } from 'azure-arm-rest/azure-arm-app-service';
import { Kudu } from 'azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceUtility } from './operations/AzureAppServiceUtility';
import tl = require('vsts-task-lib/task');
import * as ParameterParser from './operations/ParameterParserUtility'
import { addReleaseAnnotation } from './operations/ReleaseAnnotationUtility';
import { ContainerBasedDeploymentUtility } from './operations/ContainerBasedDeploymentUtility';
const linuxFunctionStorageSetting: string = '-WEBSITES_ENABLE_APP_SERVICE_STORAGE false';

export class AzureRmWebAppDeploymentProvider{
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
        this.appService = new AzureAppService(this.taskParams.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName, this.taskParams.WebAppKind);
        this.appServiceUtility = new AzureAppServiceUtility(this.appService);

        this.kuduService = await this.appServiceUtility.getKuduService();
        this.kuduServiceUtility = new KuduServiceUtility(this.kuduService);
    }

    public async DeployWebAppStep() {
        tl.debug("Performing container based deployment.");

        if(this.taskParams.isFunctionApp) {
            var customApplicationSetting = ParameterParser.parse(linuxFunctionStorageSetting);
            await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);
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
        
        let appServiceApplicationUrl: string = await this.appServiceUtility.getApplicationURL();
        console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
        tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
    }
}