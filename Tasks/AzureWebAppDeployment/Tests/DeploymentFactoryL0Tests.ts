import tl = require('vsts-task-lib');
import { DeploymentFactory } from '../deploymentProvider/DeploymentFactory';
import { IWebAppDeploymentProvider } from '../deploymentProvider/IWebAppDeploymentProvider';
import { TaskParametersUtility, TaskParameters, DeploymentType } from '../taskparameters';
import { PackageType } from 'azurermdeploycommon/webdeployment-common/packageUtility';
import { getMockEndpoint } from '../node_modules/azurermdeploycommon/Tests/mock_utils';
import { mockAzureARMPreDeploymentSteps }  from "./mock_utils";

getMockEndpoint();
mockAzureARMPreDeploymentSteps();

export class DeploymentFactoryL0Tests  {

    public static async startDeploymentFactoryL0Tests() {
        await DeploymentFactoryL0Tests.testForLinuxWebDeploymentProvider();
        await DeploymentFactoryL0Tests.testForWindowsWebAppRunFromZipProvider();
        await DeploymentFactoryL0Tests.testForWindowsWebAppWarDeployProvider();
        await DeploymentFactoryL0Tests.testForWindowsWebAppZipDeployProvider()
        await DeploymentFactoryL0Tests.testForWindowsWebAppZipDeployProvider_UserSelected();
        await DeploymentFactoryL0Tests.testForWindowsWebAppRunFromZipProvider_UserSelected();
    }

    public static async testForLinuxWebDeploymentProvider() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            var linuxWebAppDeploymentProvider: IWebAppDeploymentProvider = await new DeploymentFactory(taskParameters).GetDeploymentProvider();
            if(linuxWebAppDeploymentProvider.constructor.name === "BuiltInLinuxWebAppDeploymentProvider") {
                tl.setResult(tl.TaskResult.Succeeded, 'LinuxWebAppDeploymentProvider should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'LinuxWebAppDeploymentProvider should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'LinuxWebAppDeploymentProvider should be excepted but failed with error. ' + error);
        }
    }

    public static async testForWindowsWebAppRunFromZipProvider() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.Package.isMSBuildPackage = () :Promise<boolean> => {return Promise.resolve(false)};
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var windowsWebAppZipDeployProvider: IWebAppDeploymentProvider = await deploymentFactory.GetDeploymentProvider();
            if(windowsWebAppZipDeployProvider.constructor.name === "WindowsWebAppRunFromZipProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppRunFromZipProvider should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppRunFromZipProvider should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppRunFromZipProvider should be excepted but failed with error. ' + error);
        }
    }

    public static async testForWindowsWebAppWarDeployProvider() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.war};
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var windowsWebAppWarDeployProvider: IWebAppDeploymentProvider = await deploymentFactory.GetDeploymentProvider();
            if(windowsWebAppWarDeployProvider.constructor.name === "WindowsWebAppWarDeployProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppWarDeployProvider should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppWarDeployProvider should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppWarDeployProvider should be excepted but failed with error. ' + error);
        }
    }

    public static async testForWindowsWebAppZipDeployProvider() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.Package.getPackageType = () :PackageType => {return PackageType.jar};
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var windowsWebAppZipDeployProvider: IWebAppDeploymentProvider = await deploymentFactory.GetDeploymentProvider();
            if(windowsWebAppZipDeployProvider.constructor.name === "WindowsWebAppZipDeployProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppZipDeployProvider should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppZipDeployProvider should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppZipDeployProvider should be excepted but failed with error. ' + error);
        }
    }

    public static async testForWindowsWebAppZipDeployProvider_UserSelected() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.DeploymentType =  DeploymentType.zipDeploy;
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var windowsWebAppZipDeployProvider: IWebAppDeploymentProvider = await deploymentFactory.GetDeploymentProvider();
            if(windowsWebAppZipDeployProvider.constructor.name === "WindowsWebAppZipDeployProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppZipDeployProvider for user selected should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppZipDeployProvider for user selected should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppZipDeployProvider for user selected should be excepted but failed with error. ' + error);
        }
    }

    public static async testForWindowsWebAppRunFromZipProvider_UserSelected() {
        try {
            var taskParameters: TaskParameters = await TaskParametersUtility.getParameters();
            taskParameters.isLinuxApp = false;
            taskParameters.DeploymentType =  DeploymentType.runFromZip;
            var deploymentFactory: DeploymentFactory = new DeploymentFactory(taskParameters);
            var windowsWebAppRunFromZipProvider: IWebAppDeploymentProvider = await deploymentFactory.GetDeploymentProvider();
            if(windowsWebAppRunFromZipProvider.constructor.name === "WindowsWebAppRunFromZipProvider"){
                tl.setResult(tl.TaskResult.Succeeded, 'WindowsWebAppRunFromZipProvider for user selected should be excepted.');
            } else {
                tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppRunFromZipProvider for user selected should be excepted but failed.');
            }
        } catch(error) {
            tl.setResult(tl.TaskResult.Failed, 'WindowsWebAppRunFromZipProvider for user selected should be excepted but failed with error. ' + error);
        }
    }

}

DeploymentFactoryL0Tests.startDeploymentFactoryL0Tests();
