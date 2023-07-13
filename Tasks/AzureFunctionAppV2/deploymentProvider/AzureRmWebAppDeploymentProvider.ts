import tl = require('azure-pipelines-task-lib/task');
import { AzureAppService } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service';
import { Kudu } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service-kudu';
import { AzureAppServiceUtility } from 'azure-pipelines-tasks-azure-arm-rest/azureAppServiceUtility';
import * as ParameterParser from 'azure-pipelines-tasks-webdeployment-common/ParameterParserUtility'
import { PackageUtility } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { AzureDeployPackageArtifactAlias } from 'azure-pipelines-tasks-azure-arm-rest/constants';
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

    constructor(taskParams: TaskParameters) {
        this.taskParams = taskParams;
        let packageArtifactAlias = PackageUtility.getArtifactAlias(this.taskParams.Package.getPath());
        tl.setVariable(AzureDeployPackageArtifactAlias, packageArtifactAlias);
    }

    public async PreDeploymentStep() {
        this.appService = new AzureAppService(this.taskParams.azureEndpoint, this.taskParams.ResourceGroupName, this.taskParams.WebAppName,
            this.taskParams.SlotName, this.taskParams.WebAppKind);
        this.appServiceUtility = new AzureAppServiceUtility(this.appService, "AzureFunctionAppDeployment");
        this.appServiceUtilityExt = new AzureAppServiceUtilityExt(this.appService);

        this.kuduService = await this.appServiceUtility.getKuduService();
        this.kuduServiceUtility = new KuduServiceUtility(this.kuduService);

        await this.appServiceUtilityExt.getFuntionAppNetworkingCheck(this.taskParams.isLinuxApp);
    }

    public async DeployWebAppStep() {}

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        await addReleaseAnnotation(this.taskParams.azureEndpoint, this.appService, isDeploymentSuccess);
        if (this.kuduServiceUtility) {
            this.activeDeploymentID = await this.kuduServiceUtility.updateDeploymentStatus(isDeploymentSuccess, null, {'type': 'Deployment', slotName: this.appService.getSlot()});
            tl.debug('Active DeploymentId :'+ this.activeDeploymentID);
        }

        if (this.appServiceUtility) {
            let appServiceApplicationUrl: string = await this.appServiceUtility.getApplicationURL();
            console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
            tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
        }
    }

    protected async PostDeploymentStep() {
        if (this.taskParams.AppSettings) {
            var customApplicationSettings = ParameterParser.parse(this.taskParams.AppSettings);
            await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSettings);
        }

        await this.appServiceUtilityExt.updateScmTypeAndConfigurationDetails();
    }
}