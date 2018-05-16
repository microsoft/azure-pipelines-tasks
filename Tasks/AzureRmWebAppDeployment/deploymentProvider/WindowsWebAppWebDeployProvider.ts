import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import { DeployWar } from '../operations/WarDeploymentUtilities';
import * as Constant from '../operations/Constants';
import { WebDeployUtility } from '../operations/WebDeployUtility';
import { AzureAppServiceUtility } from '../operations/AzureAppServiceUtility';
import { Package } from 'webdeployment-common/packageUtility';
import * as ParameterParser from '../operations/parameterparser'

var packageUtility = require('webdeployment-common/packageUtility.js');
var deployUtility = require('webdeployment-common/utility.js');
var msDeploy = require('webdeployment-common/deployusingmsdeploy.js');
const runFromZipAppSetting: string = 'WEBSITE_RUN_FROMZIP 1';

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

        await this.PostDeploymentStep();
    }
}