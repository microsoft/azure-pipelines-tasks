import { IWebAppDeploymentProvider } from "./IWebAppDeploymentProvider";
import { TaskParameters } from "../operations/TaskParameters";
import {PublishProfileUtility} from '../operations/PublishProfileUtility';
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import tl = require('vsts-task-lib/task');

var packageUtility = require('webdeployment-common/packageUtility.js');
var deployUtility = require('webdeployment-common/utility.js');
var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');

export class PublishProfileWebAppDeploymentProvider implements IWebAppDeploymentProvider{
    private taskParams: TaskParameters;

    constructor(taskParams: TaskParameters) {
        this.taskParams = taskParams;
    }

    public async PredeploymentStep(){ }

    public async DeployWebAppStep() {
        var msDeployPublishingProfile = await PublishProfileUtility.GetTaskParametersFromPublishProfileFile(this.taskParams);
        var webPackage = packageUtility.PackageUtility.getPackagePath(this.taskParams.Package);
        var isFolderBasedDeployment = deployUtility.isInputPkgIsFolder(webPackage);
        webPackage = await FileTransformsUtility.applyTransformations(webPackage, this.taskParams);

        tl.debug("Performing the deployment of webapp.");
        if(!tl.osType().match(/^Win/)){
            throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
        }

        await msDeploy.DeployUsingMSDeploy(webPackage, this.taskParams.WebAppName, msDeployPublishingProfile, 
            this.taskParams.RemoveAdditionalFilesFlag, this.taskParams.ExcludeFilesFromAppDataFlag, this.taskParams.TakeAppOfflineFlag,
            this.taskParams.VirtualApplication, this.taskParams.SetParametersFile, this.taskParams.AdditionalArguments,
            isFolderBasedDeployment, this.taskParams.UseWebDeploy);
    }

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean){ }
}