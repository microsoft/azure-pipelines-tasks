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

    public async updateSiteContainers(siteContainers: SiteContainer[]): Promise<void> {

        console.log(tl.loc('StartedUpdatingSiteContainers'));

        for (const siteContainer of siteContainers) {
            console.log(tl.loc('UpdatingSiteContainer', siteContainer.getName()));
            await this._appServiceUtility.updateSiteContainer(siteContainer);
        }

        console.log(tl.loc('CompletedUpdatingSiteContainers'));
    }
}