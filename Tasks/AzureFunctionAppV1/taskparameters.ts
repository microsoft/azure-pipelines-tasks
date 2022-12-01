import { AzureEndpoint } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azureModels';
import tl = require('azure-pipelines-task-lib/task');
import { Package, PackageType } from 'azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/packageUtility';
var webCommonUtility = require('azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/utility.js');
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azurermdeploycommon-v3/azure-arm-rest/azure-arm-endpoint';
import { AzureResourceFilterUtility } from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/AzureResourceFilterUtility';
import { AzureAppService } from './azure-arm-rest/azure-arm-app-service';
const skuDynamicValue: string = 'dynamic';
const skuElasticPremiumValue: string = 'elasticpremium';

const webAppKindMap = new Map([
    [ 'functionapp', 'functionApp' ],
    [ 'functionapp,linux,container', 'functionAppLinux' ],
    [ 'functionapp,linux', 'functionAppLinux' ]
]);

export class TaskParametersUtility {

    public static async getParameters(): Promise<TaskParameters> {
        var taskParameters: TaskParameters = {
            connectedServiceName: tl.getInput('azureSubscription', true),
            WebAppKind: tl.getInput('appType', false),
            DeployToSlotOrASEFlag: tl.getBoolInput('deployToSlotOrASE', false),
            WebConfigParameters: tl.getInput('customWebConfig', false),
            AppSettings: tl.getInput('appSettings', false),
            StartupCommand: tl.getInput('startUpCommand', false),
            ConfigurationSettings: tl.getInput('configurationStrings', false),
            WebAppName: tl.getInput('appName', true)
        }  

        //Clear input if deploytoslot is disabled
        taskParameters.ResourceGroupName = (!!taskParameters.DeployToSlotOrASEFlag) ? tl.getInput('resourceGroupName', false) : null;
        taskParameters.SlotName = (!!taskParameters.DeployToSlotOrASEFlag) ? tl.getInput('slotName', false) : "production";
        tl.debug(`SlotName : ${taskParameters.SlotName}`);

        taskParameters.azureEndpoint = await new AzureRMEndpoint(taskParameters.connectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', taskParameters.WebAppName));

        if(taskParameters.AppSettings && taskParameters.AppSettings !== null)
        {
            taskParameters.AppSettings = taskParameters.AppSettings.replace('\n',' ');
        }
        
        var appDetails = await this.getWebAppKind(taskParameters);
        taskParameters.ResourceGroupName = appDetails["resourceGroupName"];
        taskParameters.WebAppKind = appDetails["webAppKind"];
        taskParameters.isConsumption = appDetails["sku"].toLowerCase() == skuDynamicValue;
        taskParameters.isPremium = appDetails["sku"].toLowerCase() == skuElasticPremiumValue;
        
        taskParameters.isLinuxApp = taskParameters.WebAppKind && taskParameters.WebAppKind.indexOf("Linux") !=-1;

        var endpointTelemetry = '{"endpointId":"' + taskParameters.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);
       
        taskParameters.Package = new Package(tl.getPathInput('package', true));
        taskParameters.WebConfigParameters = this.updateWebConfigParameters(taskParameters);

        if(taskParameters.isLinuxApp) {
            taskParameters.RuntimeStack = tl.getInput('runtimeStack', false);
        }

        taskParameters.DeploymentType = DeploymentType[(tl.getInput('deploymentMethod', false))];

        return taskParameters;
    }

    private static async getWebAppKind(taskParameters: TaskParameters): Promise<any> {
        var resourceGroupName = taskParameters.ResourceGroupName;
        var kind = taskParameters.WebAppKind;
        var sku;
        if (!resourceGroupName) {
            var appDetails = await AzureResourceFilterUtility.getAppDetails(taskParameters.azureEndpoint, taskParameters.WebAppName);
            resourceGroupName = appDetails["resourceGroupName"];
            if(!kind) {
                kind = webAppKindMap.get(appDetails["kind"]) ? webAppKindMap.get(appDetails["kind"]) : appDetails["kind"];
            }
            tl.debug(`Resource Group: ${resourceGroupName}`);
        }

        var appService = new AzureAppService(taskParameters.azureEndpoint, resourceGroupName, taskParameters.WebAppName);
        var configSettings = await appService.get(true);
        if(!kind) {
            kind = webAppKindMap.get(configSettings.kind) ? webAppKindMap.get(configSettings.kind) : configSettings.kind;
        }

        sku = configSettings.properties.sku;
        tl.debug(`Sku: ${sku}`);
        return {
            resourceGroupName: resourceGroupName,
            webAppKind: kind,
            sku: sku
        };
    }

    private static updateWebConfigParameters(taskParameters: TaskParameters): string {
        tl.debug("intially web config parameters :" + taskParameters.WebConfigParameters);
        var webConfigParameters = taskParameters.WebConfigParameters;
        if(taskParameters.Package.getPackageType() === PackageType.jar && (!taskParameters.isLinuxApp)) {
            if(!webConfigParameters) {
                webConfigParameters = "-appType java_springboot";
            }
            if(webConfigParameters.indexOf("-appType java_springboot") < 0) {
                webConfigParameters += " -appType java_springboot";
            }
            if(webConfigParameters.indexOf("-JAR_PATH D:\\home\\site\\wwwroot\\*.jar") >= 0) {
                var jarPath = webCommonUtility.getFileNameFromPath(taskParameters.Package.getPath());
                webConfigParameters = webConfigParameters.replace("D:\\home\\site\\wwwroot\\*.jar", jarPath);
            } else if(webConfigParameters.indexOf("-JAR_PATH ") < 0) {
                var jarPath = webCommonUtility.getFileNameFromPath(taskParameters.Package.getPath());
                webConfigParameters += " -JAR_PATH " + jarPath;
            }
            if(webConfigParameters.indexOf("-Dserver.port=%HTTP_PLATFORM_PORT%") > 0) {
                webConfigParameters = webConfigParameters.replace("-Dserver.port=%HTTP_PLATFORM_PORT%", "");  
            }
            tl.debug("web config parameters :" + webConfigParameters);
        }
        return webConfigParameters;
    }
}

export enum DeploymentType {
    auto,
    zipDeploy,
    runFromPackage,
    warDeploy
}

export interface TaskParameters {
    connectedServiceName: string;
    WebAppName: string;
    WebAppKind?: string;
    DeployToSlotOrASEFlag?: boolean;
    ResourceGroupName?: string;
    SlotName?: string;
    Package?: Package;
    WebConfigParameters?: string;
    DeploymentType?: DeploymentType;
    AppSettings?: string;
    StartupCommand?: string;
    RuntimeStack?: string;
    ConfigurationSettings?: string;
    /** Additional parameters */
    azureEndpoint?: AzureEndpoint;
    isLinuxApp?: boolean;
    isConsumption?: boolean;
    isPremium?: boolean;
}