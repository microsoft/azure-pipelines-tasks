import tl = require('azure-pipelines-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { BuiltInLinuxWebAppDeploymentProvider } from '../deploymentProvider/BuiltInLinuxWebAppDeploymentProvider'
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../operations/TaskParameters';
import { stringify } from 'querystring';
import { PackageType } from 'webdeployment-common-v2/packageUtility';

export class DeploymentFactoryL0Tests  {

    public static async startDeploymentFactoryL0Tests() {
        await DeploymentFactoryL0Tests.testForLinuxWebDeploymentProvider();
        await DeploymentFactoryL0Tests.testForWindowsWebAppRunFromZipProvider();
        await DeploymentFactoryL0Tests.testForWindowsWebAppWarDeployProvider();
        await DeploymentFactoryL0Tests.testForWindowsWebAppZipDeployProvider()
        await DeploymentFactoryL0Tests.testForPublishProfileProvider();
        await DeploymentFactoryL0Tests.testForContainerWebAppDeploymentProvider();
        await DeploymentFactoryL0Tests.testForWindowsWebAppZipDeployProvider_UserSelected();
        await DeploymentFactoryL0Tests.testForWindowsWebAppRunFromZipProvider_UserSelected();
        await DeploymentFactoryL0Tests.testForWindowsWebAppWebDeployProvider_UserSelected()
    }

    public static async testForLinuxWebDeploymentProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            var deploymentProviders = await new DeploymentFactory(taskParameters).GetDeploymentProviders();
            var linuxWebAppDeploymentProvider: IWebAppDeploymentProvider = deploymentProviders[0];
            if(linuxWebAppDeploymentProvider.constructor.name === "BuiltInLinuxWebAppDeploymentProvider") {
                tl.setResult(tl.TaskResult.Succeeded, 'LinuxWebAppDeploymentProvider should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'LinuxWebAppDeploymentProvider should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'LinuxWebAppDeploymentProvider should be excepted but failed with error.'+error);
        }
    }

    public static async testForWindowsWebAppRunFromZipProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.Package.isMSBuildPackage = () :Promise<boolean> => {return Promise.resolve(false)};
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var deploymentProviders = await deploymentFactory.GetDeploymentProviders();
            var windowsWebAppZipDeployProvider: IWebAppDeploymentProvider = deploymentProviders[0];
            if(windowsWebAppZipDeployProvider.constructor.name === "WindowsWebAppRunFromZipProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppRunFromZipProvider should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppRunFromZipProvider should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppRunFromZipProvider should be excepted but failed with error.');
        }
    }

    public static async testForWindowsWebAppWarDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.war};
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var deploymentProviders = await deploymentFactory.GetDeploymentProviders();
            var windowsWebAppWarDeployProvider: IWebAppDeploymentProvider = deploymentProviders[0];
            if(windowsWebAppWarDeployProvider.constructor.name === "WindowsWebAppWarDeployProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppWarDeployProvider should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppWarDeployProvider should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppWarDeployProvider should be excepted but failed with error.');
        }
    }

    public static async testForWindowsWebAppZipDeployProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.jar};
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var deploymentProviders = await deploymentFactory.GetDeploymentProviders();
            var windowsWebAppZipDeployProvider: IWebAppDeploymentProvider = deploymentProviders[0];
            if(windowsWebAppZipDeployProvider.constructor.name === "WindowsWebAppZipDeployProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppZipDeployProvider should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppZipDeployProvider should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppZipDeployProvider should be excepted but failed with error.');
        }
    }

    public static async testForWindowsWebAppWebDeployProvider_UserSelected() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.UseWebDeploy = true;
            taskParameters.DeploymentType =  DeploymentType.webDeploy;
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var deploymentProviders = await deploymentFactory.GetDeploymentProviders();
            var windowsWebAppWebDeployProvider: IWebAppDeploymentProvider = deploymentProviders[0];
            if(windowsWebAppWebDeployProvider.constructor.name === "WindowsWebAppWebDeployProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppWebDeployProvider for user selected should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppWebDeployProvider for user selected should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppWebDeployProvider for user selected should be excepted but failed with error.');
        }
    }

    public static async testForWindowsWebAppZipDeployProvider_UserSelected() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.UseWebDeploy = true;
            taskParameters.DeploymentType =  DeploymentType.zipDeploy;
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var deploymentProviders = await deploymentFactory.GetDeploymentProviders();
            var windowsWebAppZipDeployProvider:IWebAppDeploymentProvider = deploymentProviders[0];
            if(windowsWebAppZipDeployProvider.constructor.name === "WindowsWebAppZipDeployProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppZipDeployProvider for user selected should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppZipDeployProvider for user selected should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppZipDeployProvider for user selected should be excepted but failed with error.');
        }
    }

    public static async testForWindowsWebAppRunFromZipProvider_UserSelected() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.UseWebDeploy = true;
            taskParameters.DeploymentType =  DeploymentType.runFromZip;
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var deploymentProviders = await deploymentFactory.GetDeploymentProviders();
            var windowsWebAppRunFromZipProvider: IWebAppDeploymentProvider = deploymentProviders[0];
            if(windowsWebAppRunFromZipProvider.constructor.name === "WindowsWebAppRunFromZipProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppRunFromZipProvider for user selected should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppRunFromZipProvider for user selected should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppRunFromZipProvider for user selected should be excepted but failed with error.');
        }
    }

    public static async testForPublishProfileProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.ConnectionType = "PublishProfile";
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var deploymentProviders = await deploymentFactory.GetDeploymentProviders();
            var publishProfileProvider : IWebAppDeploymentProvider = deploymentProviders[0];
            if(publishProfileProvider.constructor.name === "PublishProfileWebAppDeploymentProvider") {
                tl.setResult(tl.TaskResult.Succeeded, 'PublishProfileWebAppDeploymentProvider should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'PublishProfileWebAppDeploymentProvider should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'PublishProfileWebAppDeploymentProvider should be excepted but failed with error.');
        }
    }

    public static async testForContainerWebAppDeploymentProvider() {
        try {
            var taskParameters: TaskParameters = TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = true;
            taskParameters.isBuiltinLinuxWebApp = false;
            taskParameters.isContainerWebApp = true;
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var deploymentProviders = await deploymentFactory.GetDeploymentProviders();
            var containerWebAppDeploymentProvider : IWebAppDeploymentProvider = deploymentProviders[0];
            if(containerWebAppDeploymentProvider.constructor.name === "ContainerWebAppDeploymentProvider") {
                tl.setResult(tl.TaskResult.Succeeded, 'ContainerWebAppDeploymentProvider should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'ContainerWebAppDeploymentProvider should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'ContainerWebAppDeploymentProvider should be excepted but failed with error.');
        }
    }

}

DeploymentFactoryL0Tests.startDeploymentFactoryL0Tests();
