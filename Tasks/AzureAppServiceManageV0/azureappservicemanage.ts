import tl = require('azure-pipelines-task-lib/task');
import path = require('path');

import { AzureRMEndpoint, dispose } from 'azure-arm-rest-v2/azure-arm-endpoint';

import {AzureAppService} from 'azure-arm-rest-v2/azure-arm-app-service';
import { AzureAppServiceUtils } from './operations/AzureAppServiceUtils';
import { AzureApplicationInsights } from 'azure-arm-rest-v2/azure-arm-appinsights';
import { AzureEndpoint } from 'azure-arm-rest-v2/azureModels';
import { AzureResourceFilterUtils } from './operations/AzureResourceFilterUtils';
import { AzureRmEndpointAuthenticationScheme } from 'azure-arm-rest-v2/constants';
import { Kudu } from 'azure-arm-rest-v2/azure-arm-app-service-kudu';
import { KuduServiceUtils } from './operations/KuduServiceUtils';
import { enableContinuousMonitoring } from './operations/ContinuousMonitoringUtils';

import publishProfileUtility = require("utility-common-v2/publishProfileUtility");

const Action = {
    SwapSlot: 'Swap Slots',
    Start: 'Start Azure App Service',
    Stop: 'Stop Azure App Service',
    Restart: 'Restart Azure App Service',
    SwapWithPrev: 'Start Swap With Preview',
    CompleteSwap: 'Complete Swap',
    CancelSwap: 'Cancel Swap',
    DeleteSlot: 'Delete Slot',
    InstallExt: 'Install Extensions',
    ContinuousMonitor: 'Enable Continuous Monitoring',
    StartWebjobs: 'Start all continuous webjobs',
    StopWebjobs: 'Stop all continuous webjobs'
}

const webAppKindMap = new Map([
    [ 'app', 'webApp' ],
    [ 'app,linux', 'webAppLinux' ],
    [ 'app,container', 'webAppContainer']
]);

const defaultslotname:string = "production";

interface TaskParameters {
    connectedServiceName,
    webAppName: string,
    specifySlotFlag: boolean,
    slotName: string,
    resourceGroupName: string,
    appInsightsResourceGroupName: string,
    appInsightsResourceName: string,
    sourceSlot: string,
    swapWithProduction: boolean,
    targetSlot: string,
    preserveVnet: boolean,
    extensionList,
    extensionOutputVariables,
    appInsightsWebTestName
}

class AppServiceManage {
    private kuduService: Kudu;
    private kuduServiceUtils: KuduServiceUtils;
    private appService: AzureAppService;
    private azureAppServiceUtils: AzureAppServiceUtils;
    private appServiceSourceSlot: AzureAppService;
    private appServiceTargetSlot: AzureAppService;
    private appServiceSourceSlotUtils: AzureAppServiceUtils;
    private appServiceTargetSlotUtils: AzureAppServiceUtils;
    private taskResult = true;
    private errorMessage: string = "";
    private updateDeploymentStatus: boolean = true;
    private action: string;
    private taskparams: TaskParameters;
    private azureEndpoint: AzureEndpoint;

    // Reads valid task inputs and ignores invalid inputs as per visibility rule 
    private async readTaskInputs() {
        this.action = tl.getInput('Action', true);
        this.taskparams = {
            connectedServiceName: tl.getInput('ConnectedServiceName', true),
            webAppName: tl.getInput('WebAppName', true),            
            appInsightsResourceGroupName: tl.getInput('AppInsightsResourceGroupName', false),
            appInsightsResourceName: tl.getInput('ApplicationInsightsResourceName', false),
            sourceSlot: tl.getInput('SourceSlot', false),
            swapWithProduction: tl.getBoolInput('SwapWithProduction', false),
            targetSlot: tl.getInput('TargetSlot', false),
            preserveVnet: tl.getBoolInput('PreserveVnet', false),
            extensionList: tl.getInput('ExtensionsList', false),
            extensionOutputVariables: tl.getInput('OutputVariable'),
            appInsightsWebTestName: tl.getInput('ApplicationInsightsWebTestName', false),
            specifySlotFlag: false,
            slotName: "",
            resourceGroupName: ""
        }
        
        let ignoreSpecifySlotFlag: boolean = this.action == Action.SwapSlot || this.action == Action.SwapWithPrev || this.action == Action.CompleteSwap || this.action == Action.CancelSwap || this.action == Action.DeleteSlot;
        this.taskparams.specifySlotFlag = !ignoreSpecifySlotFlag ? tl.getBoolInput('SpecifySlot', false) : false;
        this.taskparams.slotName = this.taskparams.specifySlotFlag || (this.action == Action.DeleteSlot || this.action == Action.CompleteSwap) ? tl.getInput('Slot', false) : defaultslotname;
        this.taskparams.resourceGroupName = (!!ignoreSpecifySlotFlag || !!this.taskparams.specifySlotFlag) ? tl.getInput('ResourceGroupName', false) : '';

        this.azureEndpoint = await new AzureRMEndpoint(this.taskparams.connectedServiceName).getEndpoint();
        let endpointTelemetry = '{"endpointId":"' + this.taskparams.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureAppServiceManage]" + endpointTelemetry);
    }

    // Fetch app service resource group name
    private async getRgName() {
        if(!this.taskparams.resourceGroupName) {
            this.taskparams.resourceGroupName = await AzureResourceFilterUtils.getResourceGroupName(this.azureEndpoint, 'Microsoft.Web/Sites', this.taskparams.webAppName);
        }
        tl.debug(`Resource Group: ${this.taskparams.resourceGroupName}`);
    }

    // Initializing kudu instance when publish profile is provided as auth scheme
    private async initializePublishProfile() {
        if (this.action !== Action.StartWebjobs && this.action !== Action.StopWebjobs && this.action !== Action.InstallExt) {
            throw Error(tl.loc('InvalidActionForPublishProfileEndpoint'));
        }
        let scmCreds: publishProfileUtility.ScmCredentials = await publishProfileUtility.getSCMCredentialsFromPublishProfile(this.azureEndpoint.PublishProfile);
        this.kuduService = new Kudu(scmCreds.scmUri, scmCreds.username, scmCreds.password);
        this.kuduServiceUtils = new KuduServiceUtils(this.kuduService);
    }

    // Initializing arm and kudu instances for actions operating on one app service instance/ slot
    private async initializeService() {
        if (this.azureEndpoint.scheme && this.azureEndpoint.scheme.toLowerCase() === AzureRmEndpointAuthenticationScheme.PublishProfile) {
            await this.initializePublishProfile();
        }
        else {
            await this.getRgName();
            this.appService = new AzureAppService(this.azureEndpoint, this.taskparams.resourceGroupName, this.taskparams.webAppName, this.taskparams.slotName);
            this.azureAppServiceUtils = new AzureAppServiceUtils(this.appService);
            let appServiceKuduService = await this.azureAppServiceUtils.getKuduService();
            this.kuduServiceUtils = new KuduServiceUtils(appServiceKuduService);
        }
    }

    // Initializing arm and kudu instances for actions operating on target and source slots of app service
    private async initializeSourceTargetService() {
        await this.getRgName();
        this.taskparams.targetSlot = (this.taskparams.swapWithProduction) ? defaultslotname : this.taskparams.targetSlot;
        this.appServiceSourceSlot = new AzureAppService(this.azureEndpoint, this.taskparams.resourceGroupName, this.taskparams.webAppName, this.taskparams.sourceSlot);
        this.appServiceTargetSlot = new AzureAppService(this.azureEndpoint, this.taskparams.resourceGroupName, this.taskparams.webAppName, this.taskparams.targetSlot);
        this.appServiceSourceSlotUtils = new AzureAppServiceUtils(this.appServiceSourceSlot);
        this.appServiceTargetSlotUtils = new AzureAppServiceUtils(this.appServiceTargetSlot);
    }

    // Validates if the app service selecetd for swap preview action has the capability for the same
    private async isValidSwapPreviewAppService() {
        let appService = new AzureAppService(this.azureEndpoint, this.taskparams.resourceGroupName, this.taskparams.webAppName, defaultslotname);
        let configSettings = await appService.get(true);
        let WebAppKind = webAppKindMap.get(configSettings.kind) ? webAppKindMap.get(configSettings.kind) : configSettings.kind;
        let isLinuxApp = WebAppKind && WebAppKind.indexOf("linux") !=-1;
        let isContainerApp = WebAppKind && WebAppKind.indexOf("container") !=-1;

        if(isLinuxApp || isContainerApp)
        {
            throw Error(tl.loc('SwapWithPreviewNotsupported'));
        }
    }

    public async run() {
        try {
            tl.setResourcePath(path.join( __dirname, 'task.json'));
            tl.setResourcePath(path.join( __dirname, 'node_modules/azure-arm-rest-v2/module.json'));

            // Reading task inputs
            await this.readTaskInputs();

            switch(this.action) {
                case "Start Azure App Service": {
                    await this.initializeService();
                    await this.appService.start();
                    await this.azureAppServiceUtils.monitorApplicationState("running");
                    await this.azureAppServiceUtils.pingApplication();
                    break;
                }
                case "Stop Azure App Service": {
                    await this.initializeService();
                    await this.appService.stop();
                    await this.azureAppServiceUtils.monitorApplicationState("stopped");
                    break;
                }
                case "Restart Azure App Service": {
                    await this.initializeService();
                    await this.appService.restart();
                    await this.azureAppServiceUtils.pingApplication();
                    break;
                }
                case "Delete Slot": {
                    await this.initializeService();
                    await this.appService.delete();
                    break;
                }
                case "Complete Swap":
                    await this.isValidSwapPreviewAppService();
                case "Swap Slots": {
                    await this.initializeSourceTargetService();
                    await this.advancedSlotSwap();
                    await this.appServiceSourceSlot.swap(this.taskparams.targetSlot, this.taskparams.preserveVnet);
                    break;
                }
                case "Start Swap With Preview": {
                    await this.isValidSwapPreviewAppService();
                    await this.initializeSourceTargetService();
                    await this.advancedSlotSwap();
                    await this.appServiceSourceSlot.swapSlotWithPreview(this.taskparams.targetSlot, this.taskparams.preserveVnet);
                    break;
                }
                case "Cancel Swap": {
                    await this.isValidSwapPreviewAppService();
                    await this.initializeService();
                    await this.appService.cancelSwapSlotWithPreview();
                    break;
                }
                case "Start all continuous webjobs": {
                    await this.initializeService();
                    await this.kuduServiceUtils.startContinuousWebJobs();
                    break;
                }
                case "Stop all continuous webjobs": {
                    await this.initializeService();
                    await this.kuduServiceUtils.stopContinuousWebJobs();
                    break;
                }
                case "Install Extensions": {
                    await this.initializeService();
                    let extensionOutputVariablesArray = (this.taskparams.extensionOutputVariables) ? this.taskparams.extensionOutputVariables.split(',') : [];
                    await this.kuduServiceUtils.installSiteExtensions(this.taskparams.extensionList.split(','), extensionOutputVariablesArray);
                    break;
                }
                case "Enable Continuous Monitoring": {
                    await this.initializeService();
                    let appInsights: AzureApplicationInsights = new AzureApplicationInsights(this.azureEndpoint, this.taskparams.appInsightsResourceGroupName, this.taskparams.appInsightsResourceName);
                    await enableContinuousMonitoring(this.azureEndpoint, this.appService, appInsights, this.taskparams.appInsightsWebTestName);
                    break;
                }
                default: {
                    throw Error(tl.loc('InvalidAction'));
                }
            }
        }
        catch(exception) {
            this.taskResult = false;
            this.errorMessage = exception;
        }

        tl.debug('Completed action');

        await this.postActionOperation();

        if (!this.taskResult) {
            tl.setResult(tl.TaskResult.Failed, this.errorMessage);
        }
    }

    private async postActionOperation() {
        try {
            switch(this.action) {
                case "Complete Swap":
                case "Swap Slots": {
                    if(this.appServiceSourceSlotUtils && this.appServiceTargetSlotUtils && this.updateDeploymentStatus) {
                        let sourceSlotKuduService = await this.appServiceSourceSlotUtils.getKuduService();
                        let targetSlotKuduService = await this.appServiceTargetSlotUtils.getKuduService();
                        let sourceSlotKuduServiceUtils = new KuduServiceUtils(sourceSlotKuduService);
                        let targetSlotKuduServiceUtils = new KuduServiceUtils(targetSlotKuduService);
                        let customMessage = {
                            'type': 'SlotSwap',
                            'sourceSlot': this.appServiceSourceSlot.getSlot(),
                            'targetSlot': this.appServiceTargetSlot.getSlot()
                        }
                        let DeploymentID = await sourceSlotKuduServiceUtils.updateDeploymentStatus(this.taskResult, null, customMessage);
                        await targetSlotKuduServiceUtils.updateDeploymentStatus(this.taskResult, DeploymentID, customMessage);
                    }
                    break;
                }
                case "Install Extensions": {
                    if(this.kuduServiceUtils) {
                        await this.kuduServiceUtils.updateDeploymentStatus(this.taskResult, null, { "type" : this.action });
                    }
                    break;
                }
                default: {
                    tl.debug(`deployment status not updated for action: ${this.action}`);
                }
            }
        }
        catch(error) {
            tl.debug(error);
        }
        finally {
            dispose();
        }
    }

    private async advancedSlotSwap() {        
        if(this.appServiceSourceSlot.getSlot().toLowerCase() == this.appServiceTargetSlot.getSlot().toLowerCase()) {
            this.updateDeploymentStatus = false;
            throw new Error(tl.loc('SourceAndTargetSlotCannotBeSame'));
        }
    
        console.log(tl.loc('WarmingUpSlots'));
        try {
            await Promise.all([this.appServiceSourceSlotUtils.pingApplication(), this.appServiceTargetSlotUtils.pingApplication()]);
        }
        catch(error) {
            tl.debug('Failed to warm-up slots. Error: ' + error);
        }
    }
}

let ManageInstance: AppServiceManage = new AppServiceManage();
ManageInstance.run();