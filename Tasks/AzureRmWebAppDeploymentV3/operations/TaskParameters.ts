import tl = require('azure-pipelines-task-lib/task');

export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        var taskParameters: TaskParameters = {
            connectedServiceName: tl.getInput('ConnectedServiceName', true),
            WebAppName: tl.getInput('WebAppName', true),
            WebAppKind: tl.getInput('WebAppKind', false),
            DeployToSlotFlag: tl.getBoolInput('DeployToSlotFlag', false),
            VirtualApplication: tl.getInput('VirtualApplication', false),
            Package: tl.getPathInput('Package', true),
            GenerateWebConfig: tl.getBoolInput('GenerateWebConfig', false),
            WebConfigParameters: tl.getInput('WebConfigParameters', false),
            XmlTransformation: tl.getBoolInput('XmlTransformation', false),
            JSONFiles: tl.getDelimitedInput('JSONFiles', '\n', false),
            XmlVariableSubstitution: tl.getBoolInput('XmlVariableSubstitution', false),
            UseWebDeploy: tl.getBoolInput('UseWebDeploy', false),
            TakeAppOfflineFlag: tl.getBoolInput('TakeAppOfflineFlag', false),
            RenameFilesFlag: tl.getBoolInput('RenameFilesFlag', false),
            AdditionalArguments: tl.getInput('AdditionalArguments', false),
            ScriptType: tl.getInput('ScriptType', false),
            InlineScript: tl.getInput('InlineScript', false),
            ScriptPath : tl.getPathInput('ScriptPath', false),
            DockerNamespace: tl.getInput('DockerNamespace', false),
            AppSettings: tl.getInput('AppSettings', false),
            ImageSource: tl.getInput('ImageSource', false),
            StartupCommand: tl.getInput('StartupCommand', false),
            WebAppUri: tl.getInput('WebAppUri', false),
            ConfigurationSettings: tl.getInput('ConfigurationSettings', false)
        }

        taskParameters.isLinuxApp = taskParameters.WebAppKind && taskParameters.WebAppKind.indexOf("linux") >= 0;
        taskParameters.isBuiltinLinuxWebApp = taskParameters.ImageSource && taskParameters.ImageSource.indexOf("Builtin") >= 0;
        taskParameters.isContainerWebApp = taskParameters.isLinuxApp && taskParameters.ImageSource.indexOf("Registry") >= 0;
        taskParameters.ResourceGroupName = taskParameters.DeployToSlotFlag ? tl.getInput('ResourceGroupName', false) : null;
        taskParameters.SlotName = taskParameters.DeployToSlotFlag ? tl.getInput('SlotName', false) : null;

        if(taskParameters.isLinuxApp && taskParameters.isBuiltinLinuxWebApp) {
            taskParameters.BuiltinLinuxPackage = tl.getInput('BuiltinLinuxPackage', true);
            taskParameters.RuntimeStack = tl.getInput('RuntimeStack', true);
            tl.debug('Change package path to Linux package path');
            taskParameters.Package = tl.getInput('BuiltinLinuxPackage', true);
            taskParameters.TakeAppOfflineFlag = false;
        }

        if(taskParameters.Package && taskParameters.Package.endsWith(".jar")) {
            throw new Error(tl.loc('JarNotSupported'));
        }

        taskParameters.VirtualApplication = taskParameters.VirtualApplication && taskParameters.VirtualApplication.startsWith('/') ?
            taskParameters.VirtualApplication.substr(1) : taskParameters.VirtualApplication;

        if(taskParameters.UseWebDeploy) {
            taskParameters.RemoveAdditionalFilesFlag = tl.getBoolInput('RemoveAdditionalFilesFlag', false);
            taskParameters.SetParametersFile = tl.getPathInput('SetParametersFile', false);
            taskParameters.ExcludeFilesFromAppDataFlag = tl.getBoolInput('ExcludeFilesFromAppDataFlag', false)
            taskParameters.AdditionalArguments = tl.getInput('AdditionalArguments', false);
        }

        if(taskParameters.isLinuxApp && taskParameters.ScriptType) {
            this.UpdateLinuxAppTypeScriptParameters(taskParameters);
        }

        return taskParameters;
    }

    private static UpdateLinuxAppTypeScriptParameters(taskParameters: TaskParameters) {
        let retryTimeoutValue = tl.getVariable('appservicedeploy.retrytimeout');
        let timeoutAppSettings = retryTimeoutValue ? Number(retryTimeoutValue) * 60 : 1800;

        tl.debug(`setting app setting SCM_COMMAND_IDLE_TIMEOUT to ${timeoutAppSettings}`);
        if(taskParameters.AppSettings) {
            taskParameters.AppSettings = `-SCM_COMMAND_IDLE_TIMEOUT ${timeoutAppSettings} ` + taskParameters.AppSettings;
        }
        else {
            taskParameters.AppSettings = `-SCM_COMMAND_IDLE_TIMEOUT ${timeoutAppSettings}`;
        }
    }
}

export interface TaskParameters {
    connectedServiceName: string;
    WebAppName: string;
    WebAppKind?: string;
    DeployToSlotFlag?: boolean;
    ResourceGroupName?: string;
    SlotName?: string;
    VirtualApplication?: string;
    Package: string;
    GenerateWebConfig?: boolean;
    WebConfigParameters?: string;
    XmlTransformation?: boolean;
    JSONFiles?: string[];
    XmlVariableSubstitution?: boolean;
    UseWebDeploy?: boolean;
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
    ImageSource?: string;
    StartupCommand?: string;
    BuiltinLinuxPackage?: string;
    RuntimeStack?: string;
    WebAppUri?: string;
    ConfigurationSettings?: string;
    /** Additional parameters */
    isLinuxApp?: boolean;
    isBuiltinLinuxWebApp?: boolean;
    isContainerWebApp?: boolean;
}