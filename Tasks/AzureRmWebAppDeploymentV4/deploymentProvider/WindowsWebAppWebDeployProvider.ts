import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import { DeployWar } from '../operations/WarDeploymentUtilities';
import * as Constant from '../operations/Constants';
import { WebDeployUtility } from '../operations/WebDeployUtility';

export class WindowsWebAppWebDeployProvider extends AzureRmWebAppDeploymentProvider{
 
    public async DeployWebAppStep() {
        var physicalPath: string = Constant.SiteRoot;

        if(this.taskParams.VirtualApplication) {
            physicalPath = await this.appServiceUtility.getPhysicalPath(this.taskParams.VirtualApplication);
            await this.kuduServiceUtility.createPathIfRequired(physicalPath);
            this.virtualApplicationPath = physicalPath;
        }

        var webPackage = await FileTransformsUtility.applyTransformations(this.taskParams.Package.getPath(), this.taskParams);
        
        tl.debug("Performing the deployment of webapp.");
        if(!tl.osType().match(/^Win/)) {
            throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
        }

        var msDeployPublishingProfile = await this.appServiceUtility.getWebDeployPublishingProfile();

        if(this.taskParams.Package.isWarFile()) {
            await DeployWar(webPackage, this.taskParams, msDeployPublishingProfile, this.kuduService, this.appServiceUtility);
        }
        else {
            await WebDeployUtility.publishUsingWebDeploy(this.taskParams,
                WebDeployUtility.constructWebDeployArguments(this.taskParams, msDeployPublishingProfile), this.appServiceUtility
            );
        }

        await this.PostDeploymentStep();
    }
}