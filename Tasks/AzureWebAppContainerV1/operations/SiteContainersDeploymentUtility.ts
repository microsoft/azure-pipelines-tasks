import tl = require('azure-pipelines-task-lib/task');
import { AzureAppService } from "azure-pipelines-tasks-azure-arm-rest/azure-arm-app-service";
import { AzureAppServiceUtility } from 'azure-pipelines-tasks-azure-arm-rest/azureAppServiceUtility';
import { SiteContainer } from 'azure-pipelines-tasks-azure-arm-rest/SiteContainer';

export class SiteContainersDeploymentUtility {
    private _appService: AzureAppService;
    private _appServiceUtility: AzureAppServiceUtility;

    constructor(appService: AzureAppService) {
        this._appService = appService;
        this._appServiceUtility = new AzureAppServiceUtility(appService);
    }

    public async updateSiteContainers(siteContainers: Array<SiteContainer>): Promise<void> {

        for (const siteContainer of siteContainers) {
            tl.debug(`Updating site container: ${siteContainer.getName()}`);
            await this._appServiceUtility.updateSiteContainer(siteContainer);
        }
    }
}