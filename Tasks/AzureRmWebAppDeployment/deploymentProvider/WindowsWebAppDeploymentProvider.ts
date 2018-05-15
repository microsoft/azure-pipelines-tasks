import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import { DeployWar } from '../operations/WarDeploymentUtilities';
import * as Constant from '../operations/Constants';
import { WebDeployUtility } from '../operations/WebDeployUtility';
import { AzureAppServiceUtility } from '../operations/AzureAppServiceUtility';

var packageUtility = require('webdeployment-common/packageUtility.js');
var deployUtility = require('webdeployment-common/utility.js');
var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');

export class WindowsWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider{
 
    public async DeployWebAppStep() {
        var webPackage = packageUtility.PackageUtility.getPackagePath(this.taskParams.Package);
        var isFolderBasedDeployment = deployUtility.isInputPkgIsFolder(webPackage);
        var physicalPath: string = Constant.SiteRoot;

        if(this.taskParams.VirtualApplication) {
            physicalPath = await this.appServiceUtility.getPhysicalPath(this.taskParams.VirtualApplication);
            await this.kuduServiceUtility.createPathIfRequired(physicalPath);
            this.virtualApplicationPath = physicalPath;
        }

        webPackage = await FileTransformsUtility.applyTransformations(webPackage, this.taskParams);

        if(deployUtility.canUseWebDeploy(this.taskParams.UseWebDeploy)) {
            tl.debug("Performing the deployment of webapp.");
            if(!tl.osType().match(/^Win/)){
                throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
            }

            var msDeployPublishingProfile = await this.appServiceUtility.getWebDeployPublishingProfile();

            if (webPackage.toString().toLowerCase().endsWith('.war')) {
                await DeployWar(webPackage, this.taskParams, msDeployPublishingProfile, this.kuduService, this.appServiceUtility);
            }
            else {
                await WebDeployUtility.publishUsingWebDeploy(this.taskParams,
                    WebDeployUtility.constructWebDeployArguments(this.taskParams, msDeployPublishingProfile), this.appServiceUtility
                );
            }
        }
        else {
            tl.debug("Initiated deployment via kudu service for webapp package : ");
            await this.kuduServiceUtility.deployWebPackage(webPackage, physicalPath, this.taskParams.VirtualApplication, this.taskParams.TakeAppOfflineFlag);
        }

        await this.PostDeploymentStep();
    }
}