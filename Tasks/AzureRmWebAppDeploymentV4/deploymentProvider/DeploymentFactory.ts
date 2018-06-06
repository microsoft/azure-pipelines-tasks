import { TaskParameters, DeploymentType } from '../operations/TaskParameters';
import * as Constant from '../operations/Constants'
import { PublishProfileWebAppDeploymentProvider } from './PublishProfileWebAppDeploymentProvider';
import { BuiltInLinuxWebAppDeploymentProvider } from './BuiltInLinuxWebAppDeploymentProvider';
import { IWebAppDeploymentProvider } from './IWebAppDeploymentProvider';
import { WindowsWebAppWebDeployProvider } from './WindowsWebAppWebDeployProvider';
import { WindowsWebAppZipDeployProvider } from './WindowsWebAppZipDeployProvider';
import { WindowsWebAppRunFromZipProvider } from './WindowsWebAppRunFromZipProvider';
import { ContainerWebAppDeploymentProvider } from './ContainerWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { Package } from 'webdeployment-common/packageUtility';

export class DeploymentFactory{
    public static async GetDeploymentProvider(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
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
                    if(taskParams.UseWebDeploy && taskParams.DeploymentType === DeploymentType.webDeploy) {
                        return new WindowsWebAppWebDeployProvider(taskParams);
                    }
                    else if(taskParams.UseWebDeploy && taskParams.DeploymentType === DeploymentType.zipDeploy) {
                        return new WindowsWebAppZipDeployProvider(taskParams);
                    }
                    else if(taskParams.UseWebDeploy && taskParams.DeploymentType === DeploymentType.runFromZip){
                        return new WindowsWebAppRunFromZipProvider(taskParams);
                    }
                    else {             
                        var _isMSBuildPackage = await taskParams.Package.isMSBuildPackage();           
                        if(_isMSBuildPackage || taskParams.VirtualApplication || taskParams.Package.isWarFile()) {
                            return new WindowsWebAppWebDeployProvider(taskParams);
                        }
                        else if(taskParams.ScriptType) {
                            return new WindowsWebAppZipDeployProvider(taskParams);
                        }
                        else {
                            return new WindowsWebAppRunFromZipProvider(taskParams);
                        }
                    }
                }
            default:
                throw new Error(tl.loc('InvalidConnectionType'));
        }
    }
}