import { TaskParameters } from '../operations/TaskParameters';
import * as Constant from '../operations/Constants'
import { PublishProfileWebAppDeploymentProvider } from './PublishProfileWebAppDeploymentProvider';
import { BuiltInLinuxWebAppDeploymentProvider } from './BuiltInLinuxWebAppDeploymentProvider';
import { IWebAppDeploymentProvider } from './IWebAppDeploymentProvider';
import { WindowsWebAppDeploymentProvider } from './WindowsWebAppDeploymentProvider';
import { ContainerWebAppDeploymentProvider } from './ContainerWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');

export class DeploymentFactory{
    public static GetDeploymentProvider(taskParams: TaskParameters): IWebAppDeploymentProvider {
        switch(taskParams.ConnectionType) {
            case Constant.ConnectionType.PublishProfile:
                return new PublishProfileWebAppDeploymentProvider(taskParams);
            case Constant.ConnectionType.AzureRM:
                if(taskParams.isLinuxApp) {
                    if(taskParams.isBuiltinLinuxWebApp) {
                        return new BuiltInLinuxWebAppDeploymentProvider(taskParams);
                    } else if(taskParams.isContainerWebApp) {
                        return new ContainerWebAppDeploymentProvider(taskParams);
                    } else {
                        throw new Error(tl.loc('InvalidImageSourceType'));
                    }
                } else {
                    return new WindowsWebAppDeploymentProvider(taskParams);
                }
            default:
                throw new Error(tl.loc('InvalidConnectionType'));
        }
    }
}