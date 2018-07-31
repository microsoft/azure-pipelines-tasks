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
import { Package, PackageType } from 'webdeployment-common/packageUtility';
import { WindowsWebAppWarDeployProvider } from './WindowsWebAppWarDeployProvider';

export class DeploymentFactory{
    public static async GetDeploymentProvider(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
        switch(taskParams.ConnectionType) {
            case Constant.ConnectionType.PublishProfile:
                return new PublishProfileWebAppDeploymentProvider(taskParams);
            case Constant.ConnectionType.AzureRM:
                if(taskParams.isLinuxApp) {
                    return await DeploymentFactory._getLinuxDeploymentProvider(taskParams);
                } else {
                    return await DeploymentFactory._getWindowsDeploymentProvider(taskParams)
                }
            default:
                throw new Error(tl.loc('InvalidConnectionType'));
        }
    }

    private static async _getLinuxDeploymentProvider(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
        if(taskParams.isBuiltinLinuxWebApp) {
            return new BuiltInLinuxWebAppDeploymentProvider(taskParams);
        } else if(taskParams.isContainerWebApp) {
            return new ContainerWebAppDeploymentProvider(taskParams);
        } else {
            throw new Error(tl.loc('InvalidImageSourceType'));
        }
    }

    private static async _getWindowsDeploymentProvider(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
        switch(taskParams.Package.getPackageType()){
            case PackageType.war:
                return new WindowsWebAppWarDeployProvider(taskParams);
            case PackageType.jar:
                return await DeploymentFactory._getWindowsDeploymentProviderForZipDeployAndRunFromZipMethod(taskParams);
            default:
                return await DeploymentFactory._getWindwosDeploymentProviderForZipAndFolderPackageType(taskParams);
            }
    }

    private static async _getWindwosDeploymentProviderForZipAndFolderPackageType(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
        if(taskParams.UseWebDeploy) {
            return await DeploymentFactory._getUserSelectedDeploymentProviderForWindow(taskParams);
        } else {             
            var _isMSBuildPackage = await taskParams.Package.isMSBuildPackage();           
            if(_isMSBuildPackage || taskParams.VirtualApplication) {
                return new WindowsWebAppWebDeployProvider(taskParams);
            } else {
                return await DeploymentFactory._getWindowsDeploymentProviderForZipDeployAndRunFromZipMethod(taskParams);
            }
        }
    }

    private static async _getUserSelectedDeploymentProviderForWindow(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
        switch(taskParams.DeploymentType){
            case DeploymentType.webDeploy:
                return new WindowsWebAppWebDeployProvider(taskParams);
            case DeploymentType.zipDeploy:
                return new WindowsWebAppZipDeployProvider(taskParams);
            case DeploymentType.runFromZip:
                return new WindowsWebAppRunFromZipProvider(taskParams);
        }
    }

    private static async _getWindowsDeploymentProviderForZipDeployAndRunFromZipMethod(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
        if(taskParams.ScriptType) {
            return new WindowsWebAppZipDeployProvider(taskParams);
        } else {
            return new WindowsWebAppRunFromZipProvider(taskParams);
        }
    }

}