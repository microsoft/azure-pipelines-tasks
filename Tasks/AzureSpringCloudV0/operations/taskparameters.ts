import tl = require('azure-pipelines-task-lib/task');
import { Package, PackageType } from 'webdeployment-common-v2/packageUtility';

export class Inputs {
    public static readonly connectedServiceName = 'ConnectedServiceName';
    public static readonly azureSpringCloud = 'AzureSpringCloud';
    public static readonly action = 'Action';
    public static readonly appName = 'AppName';
    public static readonly targetInactive = 'TargetInactive';
    public static readonly createNewDeployment = 'CreateNewDeployment';
    public static readonly deploymentName = 'DeploymentName';
    public static readonly environmentVariables = 'EnvironmentVariables';
    public static readonly jvmOptions = 'JvmOptions'
    public static readonly runtimeVersion = 'RuntimeVersion';
    public static readonly version = 'Version';
}

export class Actions {
    public static readonly deploy='Deploy';
    public static readonly setProduction='Set Production';
    public static readonly deleteStagingDeployment='Delete Staging Deployment';
}

export class TaskParametersUtility {
    public static getParameters(): TaskParameters {
        var taskParameters: TaskParameters = {
            ConnectedServiceName: tl.getInput(Inputs.connectedServiceName, true),
            AzureSpringCloud: tl.getInput(Inputs.azureSpringCloud, true),
            Action: tl.getInput(Inputs.action, true),
            AppName: tl.getInput(Inputs.appName, true),
            TargetInactive: tl.getBoolInput(Inputs.targetInactive, true),
            CreateNewDeployment: tl.getBoolInput(Inputs.createNewDeployment, false),
            DeploymentName: null,
            EnvironmentVariables: tl.getInput(Inputs.environmentVariables, false),
            JvmOptions: tl.getInput(Inputs.jvmOptions, false),
            RuntimeVersion: tl.getInput(Inputs.runtimeVersion, false),
            Version: tl.getInput(Inputs.version, false)
        }

        //Do not attempt to parse package in non-deployment steps. This causes variable substitution errors.
        if (taskParameters.Action == Actions.deploy) {
            taskParameters.Package = new Package(tl.getPathInput('Package', true));
        }

        //For UI to work, we need different deployment boxes for different actions. Hence...
        if (taskParameters.Action == Actions.deploy && !taskParameters.TargetInactive){
            taskParameters.DeploymentName = tl.getInput('DeploymentNameForDeploy');
        } else if (taskParameters.Action == Actions.setProduction && !taskParameters.TargetInactive){
            taskParameters.DeploymentName = tl.getInput('DeploymentNameForSetDeployment');
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
    TargetInactive: boolean;
    CreateNewDeployment: boolean;
    DeploymentName: string;
    EnvironmentVariables?: string;
    Package?: Package;
    JvmOptions?: string;
    RuntimeVersion: string;
    Version?: string;
}