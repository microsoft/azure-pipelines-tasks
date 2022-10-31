import { Package, PackageType } from 'azure-pipelines-tasks-webdeployment-common-v4/packageUtility';

export class Inputs {
    public static readonly connectedServiceName = 'ConnectedServiceName';
    public static readonly azureSpringCloud = 'AzureSpringCloud';
    public static readonly action = 'Action';
    public static readonly appName = 'AppName';
    public static readonly deploymentType = 'DeploymentType';
    public static readonly useStagingDeployment = 'UseStagingDeployment';
    public static readonly createNewDeployment = 'CreateNewDeployment';
    public static readonly deploymentName = 'DeploymentName';
    public static readonly environmentVariables = 'EnvironmentVariables';
    public static readonly jvmOptions = 'JvmOptions'
    public static readonly runtimeVersion = 'RuntimeVersion';
    public static readonly dotNetCoreMainEntryPath = 'DotNetCoreMainEntryPath';
    public static readonly version = 'Version';
    public static readonly package = 'Package';
    public static readonly builder = 'Builder';
    public static readonly containerRegistry = "ContainerRegistry";
    public static readonly registryUsername = "RegistryUsername";
    public static readonly registryPassword = "RegistryPassword";
    public static readonly containerImage = "ContainerImage";
    public static readonly containerCommand = "ContainerCommand";
    public static readonly containerArgs = "ContainerArgs";
    public static readonly languageFramework = "LanguageFramework";

}

export class Actions {
    public static readonly deploy = 'Deploy';
    public static readonly setProduction = 'Set Production';
    public static readonly deleteStagingDeployment = 'Delete Staging Deployment';
}

export class DeploymentType {
    public static readonly artifacts = 'Artifacts';
    public static readonly customContainer = 'CustomContainer';

    public static isArtifacts(deploymentType: string): boolean {
        return !deploymentType      // For backward-compatibility
            || deploymentType == DeploymentType.artifacts;
    }
}

export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        console.log("global['_vsts_task_lib_loaded'] = " + global['_vsts_task_lib_loaded']);
        var tl = require('azure-pipelines-task-lib/task');
        console.log('Started getParameters');
        console.log("global['_vsts_task_lib_loaded'] = " + global['_vsts_task_lib_loaded']);
        var taskParameters: TaskParameters = {
            ConnectedServiceName: tl.getInput(Inputs.connectedServiceName, true),
            AzureSpringCloud: tl.getInput(Inputs.azureSpringCloud, true),
            Action: tl.getInput(Inputs.action, true),
            AppName: tl.getInput(Inputs.appName, true),
            DeploymentType: tl.getInput(Inputs.deploymentType, false),
            UseStagingDeployment: tl.getBoolInput(Inputs.useStagingDeployment, true),
            CreateNewDeployment: tl.getBoolInput(Inputs.createNewDeployment, false),
            DeploymentName: tl.getInput(Inputs.deploymentName, !tl.getBoolInput(Inputs.useStagingDeployment, true)),
            EnvironmentVariables: tl.getInput(Inputs.environmentVariables, false),
            JvmOptions: tl.getInput(Inputs.jvmOptions, false),
            RuntimeVersion: tl.getInput(Inputs.runtimeVersion, false),
            DotNetCoreMainEntryPath: tl.getInput(Inputs.dotNetCoreMainEntryPath, false),
            Version: tl.getInput(Inputs.version, false),
            Builder: tl.getInput(Inputs.builder, false),
            ContainerRegistry: tl.getInput(Inputs.containerRegistry, false),
            RegistryUsername: tl.getInput(Inputs.registryUsername, false),
            RegistryPassword: tl.getInput(Inputs.registryPassword, false),
            ContainerImage: tl.getInput(Inputs.containerImage, false),
            ContainerCommand: tl.getInput(Inputs.containerCommand, false),
            ContainerArgs: tl.getInput(Inputs.containerArgs, false),
            LanguageFramework: tl.getInput(Inputs.languageFramework, false),
        }

        //Do not attempt to parse package in non-deployment steps. This causes variable substitution errors.
        if (taskParameters.Action == Actions.deploy && DeploymentType.isArtifacts(taskParameters.DeploymentType)) {
            taskParameters.Package = new Package(tl.getPathInput(Inputs.package, true));
        }

        tl.debug('Task parameters: ' + JSON.stringify(taskParameters));
        return taskParameters;
    }
}


export interface TaskParameters {
    ConnectedServiceName?: string;
    Action: string;
    AzureSpringCloud: string; //Could be resource ID or name
    AppName: string;
    DeploymentType?: string;
    UseStagingDeployment?: boolean;
    CreateNewDeployment?: boolean;
    DeploymentName?: string;
    EnvironmentVariables?: string;
    Package?: Package;
    JvmOptions?: string;
    RuntimeVersion?: string;
    DotNetCoreMainEntryPath?: string;
    Version?: string;
    Builder?: string;
    ContainerRegistry?: string;
    RegistryUsername?: string;
    RegistryPassword?: string;
    ContainerImage?: string;
    ContainerCommand?: string;
    ContainerArgs?: string;
    LanguageFramework?: string;
}