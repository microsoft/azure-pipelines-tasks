import { TaskParameters, DeploymentType, TaskParametersUtility } from '../operations/TaskParameters';
import * as Constant from '../operations/Constants'
import { PublishProfileWebAppDeploymentProvider } from './PublishProfileWebAppDeploymentProvider';
import { BuiltInLinuxWebAppDeploymentProvider } from './BuiltInLinuxWebAppDeploymentProvider';
import { IWebAppDeploymentProvider } from './IWebAppDeploymentProvider';
import { WindowsWebAppWebDeployProvider } from './WindowsWebAppWebDeployProvider';
import { WindowsWebAppZipDeployProvider } from './WindowsWebAppZipDeployProvider';
import { WindowsWebAppRunFromZipProvider } from './WindowsWebAppRunFromZipProvider';
import { ContainerWebAppDeploymentProvider } from './ContainerWebAppDeploymentProvider';
import tl = require('azure-pipelines-task-lib/task');
import { PackageType } from 'webdeployment-common-v2/packageUtility';
import { WindowsWebAppWarDeployProvider } from './WindowsWebAppWarDeployProvider';
import clonedeep = require('lodash/cloneDeep');

export class DeploymentFactory {

    private _taskParams: TaskParameters;

    constructor(taskParams: TaskParameters) {
        this._taskParams = taskParams;
    }

    public async GetDeploymentProviders(): Promise<IWebAppDeploymentProvider[]> {
        var appServiceNames = this._taskParams.WebAppName.split(',');

        var deploymentProviders = await Promise.all(appServiceNames.map(async appServiceName => {
            var params = clonedeep(this._taskParams);
            params.WebAppName = appServiceName.trim();

            switch(params.ConnectionType) {
                case Constant.ConnectionType.PublishProfile:
                    return new PublishProfileWebAppDeploymentProvider(params);
                case Constant.ConnectionType.AzureRM:
                    if(params.isLinuxApp) {
                        tl.debug("Deployment started for linux app service");
                        return await this._getLinuxDeploymentProvider(params);
                    } else {
                        tl.debug("Deployment started for windows app service");
                        return await this._getWindowsDeploymentProvider(params)
                    }
                default:
                    throw new Error(tl.loc('InvalidConnectionType'));
            }
        }));

        return deploymentProviders;
    }

    private async _getLinuxDeploymentProvider(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
        if(taskParams.isBuiltinLinuxWebApp) {
            return new BuiltInLinuxWebAppDeploymentProvider(taskParams);
        } else if(taskParams.isContainerWebApp) {
            return new ContainerWebAppDeploymentProvider(taskParams);
        } else {
            throw new Error(tl.loc('InvalidImageSourceType'));
        }
    }

    private async _getWindowsDeploymentProvider(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
        tl.debug("Package type of deployment is: "+ taskParams.Package.getPackageType());
        switch(taskParams.Package.getPackageType()){
            case PackageType.war:
                return new WindowsWebAppWarDeployProvider(taskParams);
            case PackageType.jar:
                return new WindowsWebAppZipDeployProvider(taskParams);
            default:
                return await this._getWindowsDeploymentProviderForZipAndFolderPackageType(taskParams);
            }
    }

    private async _getWindowsDeploymentProviderForZipAndFolderPackageType(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
        if(taskParams.UseWebDeploy) {
            return await this._getUserSelectedDeploymentProviderForWindow(taskParams);
        } else {             
            var _isMSBuildPackage = await taskParams.Package.isMSBuildPackage();           
            if(_isMSBuildPackage || taskParams.VirtualApplication) {
                return new WindowsWebAppWebDeployProvider(taskParams);
            } else if(taskParams.ScriptType) {
                return new WindowsWebAppZipDeployProvider(taskParams);
            } else {
                return new WindowsWebAppRunFromZipProvider(taskParams);
            }
        }
    }

    private async _getUserSelectedDeploymentProviderForWindow(taskParams: TaskParameters): Promise<IWebAppDeploymentProvider> {
        switch(taskParams.DeploymentType){
            case DeploymentType.webDeploy:
                return new WindowsWebAppWebDeployProvider(taskParams);
            case DeploymentType.zipDeploy:
                return new WindowsWebAppZipDeployProvider(taskParams);
            case DeploymentType.runFromZip:
                return new WindowsWebAppRunFromZipProvider(taskParams);
        }
    }
}
