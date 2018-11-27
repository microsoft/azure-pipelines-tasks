import { AzureEndpoint } from 'azurermdeploycommon/azure-arm-rest/azureModels';
import tl = require('vsts-task-lib/task');
import { Package, PackageType } from 'azurermdeploycommon/webdeployment-common/packageUtility';
var webCommonUtility = require('azurermdeploycommon/webdeployment-common/utility.js');
import { AzureRMEndpoint } from 'azurermdeploycommon/azure-arm-rest/azure-arm-endpoint';
import { AzureResourceFilterUtility } from 'azurermdeploycommon/operations/AzureResourceFilterUtility';
import { AzureAppService } from 'azurermdeploycommon/azure-arm-rest/azure-arm-app-service';

const webAppKindMap = new Map([
    [ 'functionapp', 'functionApp' ],
    [ 'functionapp,linux,container', 'functionAppLinux' ],
]);

export class TaskParametersUtility {

    public static async getParameters(): Promise<TaskParameters> {
        var taskParameters: TaskParameters = {
            connectedServiceName: tl.getInput('ConnectedServiceName', true),
            WebAppKind: tl.getInput('appType', false),
            DeployToSlotOrASEFlag: tl.getBoolInput('deployToSlotOrASE', false),
            WebConfigParameters: tl.getInput('webConfigParameters', false),
            AppSettings: tl.getInput('appSettings', false),
            StartupCommand: tl.getInput('startUpCommand', false),
            ConfigurationSettings: tl.getInput('configurationStrings', false),
            ResourceGroupName: tl.getInput('resourceGroupName', false),
            SlotName: tl.getInput('slotName', false),
            WebAppName: tl.getInput('appName', true)
        }  

        taskParameters.azureEndpoint = await new AzureRMEndpoint(taskParameters.connectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureRMWebApp0', taskParameters.WebAppName));   

        this.getWebAppKind(taskParameters);

        taskParameters.isLinuxApp = taskParameters.WebAppKind && taskParameters.WebAppKind.indexOf("Linux") !=-1;

        var endpointTelemetry = '{"endpointId":"' + taskParameters.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);
       
        taskParameters.Package = new Package(tl.getPathInput('package', true));
        this.updateWebConfigParameters(taskParameters);

        if(taskParameters.isLinuxApp) {
            taskParameters.RuntimeStack = tl.getInput('runtimeStack', false);
        }

        taskParameters.DeploymentType = DeploymentType[(tl.getInput('deploymentMethod', false))];

        return taskParameters;
    }

    private static async getWebAppKind(taskParameters: TaskParameters): Promise<void> {
        if (!taskParameters.ResourceGroupName) {
            var appDetails = await AzureResourceFilterUtility.getAppDetails(taskParameters.azureEndpoint, taskParameters.WebAppName);
            taskParameters.ResourceGroupName = appDetails["resourceGroupName"];
            if(!taskParameters.WebAppKind) {
                taskParameters.WebAppKind = webAppKindMap.get(appDetails["kind"]) ? webAppKindMap.get(appDetails["kind"]) : appDetails["kind"];
            }
            tl.debug(`Resource Group: ${taskParameters.ResourceGroupName}`);
        }
        else if(!taskParameters.WebAppKind){
            var appService = new AzureAppService(taskParameters.azureEndpoint, taskParameters.ResourceGroupName, taskParameters.WebAppName);
            var configSettings = await appService.get(true);
            taskParameters.WebAppKind = webAppKindMap.get(configSettings.kind) ? webAppKindMap.get(configSettings.kind) : configSettings.kind;
        }
    }

    private static updateWebConfigParameters(taskParameters: TaskParameters): void {
        tl.debug("intially web config parameters :" + taskParameters.WebConfigParameters);
        if(taskParameters.Package.getPackageType() === PackageType.jar && (!taskParameters.isLinuxApp)) {
            if(!taskParameters.WebConfigParameters) {
                taskParameters.WebConfigParameters = "-appType java_springboot";
            }
            if(taskParameters.WebConfigParameters.indexOf("-appType java_springboot") < 0) {
                taskParameters.WebConfigParameters += " -appType java_springboot";
            }
            if(taskParameters.WebConfigParameters.indexOf("-JAR_PATH D:\\home\\site\\wwwroot\\*.jar") >= 0) {
                var jarPath = webCommonUtility.getFileNameFromPath(taskParameters.Package.getPath());
                taskParameters.WebConfigParameters = taskParameters.WebConfigParameters.replace("D:\\home\\site\\wwwroot\\*.jar", jarPath);
            } else if(taskParameters.WebConfigParameters.indexOf("-JAR_PATH ") < 0) {
                var jarPath = webCommonUtility.getFileNameFromPath(taskParameters.Package.getPath());
                taskParameters.WebConfigParameters += " -JAR_PATH " + jarPath;
            }
            if(taskParameters.WebConfigParameters.indexOf("-Dserver.port=%HTTP_PLATFORM_PORT%") > 0) {
                taskParameters.WebConfigParameters = taskParameters.WebConfigParameters.replace("-Dserver.port=%HTTP_PLATFORM_PORT%", "");  
            }
            tl.debug("web config parameters :" + taskParameters.WebConfigParameters);
        }
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
}