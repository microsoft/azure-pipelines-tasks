import tl = require('vsts-task-lib/task');
import * as Constant from '../operations/Constants'
import { Package } from 'webdeployment-common/packageUtility';

export enum DeploymentType {
    webDeploy,
    zipDeploy,
    runFromZip
}

export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        var taskParameters: TaskParameters = {
            ConnectionType: tl.getInput('ConnectionType', true),
            WebAppKind: tl.getInput('WebAppKind', false),
            DeployToSlotOrASEFlag: tl.getBoolInput('DeployToSlotOrASEFlag', false),
            VirtualApplication: tl.getInput('VirtualApplication', false),
            GenerateWebConfig: tl.getBoolInput('GenerateWebConfig', false),
            WebConfigParameters: tl.getInput('WebConfigParameters', false),
            XmlTransformation: tl.getBoolInput('XmlTransformation', false),
            JSONFiles: tl.getDelimitedInput('JSONFiles', '\n', false),
            XmlVariableSubstitution: tl.getBoolInput('XmlVariableSubstitution', false),
            TakeAppOfflineFlag: tl.getBoolInput('TakeAppOfflineFlag', false),
            RenameFilesFlag: tl.getBoolInput('RenameFilesFlag', false),
            AdditionalArguments: tl.getInput('AdditionalArguments', false),
            ScriptType: tl.getInput('ScriptType', false),
            InlineScript: tl.getInput('InlineScript', false),
            ScriptPath : tl.getPathInput('ScriptPath', false),
            DockerNamespace: tl.getInput('DockerNamespace', false),
            AppSettings: tl.getInput('AppSettings', false),
            StartupCommand: tl.getInput('StartupCommand', false),
            ConfigurationSettings: tl.getInput('ConfigurationSettings', false)
        }
        
        if(taskParameters.ConnectionType === Constant.ConnectionType.PublishProfile) {
            this._initializeDefaultParametersForPublishProfile(taskParameters);
            return taskParameters;
        }

        taskParameters.connectedServiceName = tl.getInput('ConnectedServiceName', true);
        taskParameters.WebAppName = tl.getInput('WebAppName', true);
        taskParameters.isLinuxApp = taskParameters.WebAppKind && (taskParameters.WebAppKind.indexOf("Linux") !=-1 || taskParameters.WebAppKind.indexOf("Container") != -1);
        taskParameters.isBuiltinLinuxWebApp = taskParameters.WebAppKind.indexOf('Linux') != -1;
        taskParameters.isContainerWebApp =taskParameters.WebAppKind.indexOf('Container') != -1;
        taskParameters.ResourceGroupName = taskParameters.DeployToSlotOrASEFlag ? tl.getInput('ResourceGroupName', false) : null;
        taskParameters.SlotName = taskParameters.DeployToSlotOrASEFlag ? tl.getInput('SlotName', false) : null;

        var endpointTelemetry = '{"endpointId":"' + taskParameters.connectedServiceName + '"}';
        console.log("##vso[telemetry.publish area=TaskEndpointId;feature=AzureRmWebAppDeployment]" + endpointTelemetry);

        if(!taskParameters.isContainerWebApp){            
            taskParameters.Package = new Package(tl.getPathInput('Package', true));
        }
          
        taskParameters.UseWebDeploy = !taskParameters.isLinuxApp ? tl.getBoolInput('UseWebDeploy', false) : false;

        if(taskParameters.isLinuxApp && taskParameters.isBuiltinLinuxWebApp) {
            taskParameters.RuntimeStack = tl.getInput('RuntimeStack', true);
            taskParameters.TakeAppOfflineFlag = false;
        }

        taskParameters.VirtualApplication = taskParameters.VirtualApplication && taskParameters.VirtualApplication.startsWith('/') 
            ? taskParameters.VirtualApplication.substr(1) : taskParameters.VirtualApplication;

        if(taskParameters.UseWebDeploy) {
            taskParameters.DeploymentType = this.getDeploymentType(tl.getInput('DeploymentType', false));
            if(taskParameters.DeploymentType == DeploymentType.webDeploy) {                
                taskParameters.RemoveAdditionalFilesFlag = tl.getBoolInput('RemoveAdditionalFilesFlag', false);
                taskParameters.SetParametersFile = tl.getPathInput('SetParametersFile', false);
                taskParameters.ExcludeFilesFromAppDataFlag = tl.getBoolInput('ExcludeFilesFromAppDataFlag', false)
                taskParameters.AdditionalArguments = tl.getInput('AdditionalArguments', false) || '';
            }
        }
        else {
            // Retry Attempt is passed by default
            taskParameters.AdditionalArguments = '-retryAttempts:6 -retryInterval:10000';
        }

        return taskParameters;
    }

    private static _initializeDefaultParametersForPublishProfile(taskParameters: TaskParameters): void {
        taskParameters.PublishProfilePath = tl.getInput('PublishProfilePath', true);
        taskParameters.PublishProfilePassword = tl.getInput('PublishProfilePassword', true);
        taskParameters.Package = new Package(tl.getPathInput('Package', true));
        taskParameters.AdditionalArguments = "-retryAttempts:6 -retryInterval:10000";
    }
    
    private static getDeploymentType(type): DeploymentType {
        switch(type) {
            case "webDeploy": return DeploymentType.webDeploy;
            case "zipDeploy": return DeploymentType.zipDeploy;
            case "runFromZip": return DeploymentType.runFromZip;
        }
    }
}

export interface TaskParameters {
    ConnectionType: string;
    connectedServiceName?: string;
    PublishProfilePath?: string;
    PublishProfilePassword?: string;
    WebAppName?: string;
    WebAppKind?: string;
    DeployToSlotOrASEFlag?: boolean;
    ResourceGroupName?: string;
    SlotName?: string;
    VirtualApplication?: string;
    Package?: Package;
    GenerateWebConfig?: boolean;
    WebConfigParameters?: string;
    XmlTransformation?: boolean;
    JSONFiles?: string[];
    XmlVariableSubstitution?: boolean;
    UseWebDeploy?: boolean;
    DeploymentType?: DeploymentType;
    RemoveAdditionalFilesFlag?: boolean;
    SetParametersFile?: string;
    ExcludeFilesFromAppDataFlag?: boolean;
    TakeAppOfflineFlag?: boolean;
    RenameFilesFlag?: boolean;
    AdditionalArguments?: string;
    ScriptType?: string;
    InlineScript?: string;
    ScriptPath ?: string;
    DockerNamespace?: string;
    AppSettings?: string;
    StartupCommand?: string;
    RuntimeStack?: string;
    ConfigurationSettings?: string;
    /** Additional parameters */
    isLinuxApp?: boolean;
    isBuiltinLinuxWebApp?: boolean;
    isContainerWebApp?: boolean;
}
