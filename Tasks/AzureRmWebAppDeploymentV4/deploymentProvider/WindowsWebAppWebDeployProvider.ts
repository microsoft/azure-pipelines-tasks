import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { FileTransformsUtility } from '../operations/FileTransformsUtility';
import * as ParameterParser from 'webdeployment-common/ParameterParserUtility';
import * as Constant from '../operations/Constants';
import { WebDeployUtility } from '../operations/WebDeployUtility';
import { Package } from 'webdeployment-common/packageUtility';

const deleteOldRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_ZIP';
const removeRunFromZipAppSetting: string = '-WEBSITE_RUN_FROM_PACKAGE 0';
var deployUtility = require('webdeployment-common/utility.js');

export class WindowsWebAppWebDeployProvider extends AzureRmWebAppDeploymentProvider{
 
    public async DeployWebAppStep() {
        var physicalPath: string = Constant.SiteRoot;
        var webPackage = this.taskParams.Package.getPath();

        if(this.taskParams.VirtualApplication) {
            physicalPath = await this.appServiceUtility.getPhysicalPath(this.taskParams.VirtualApplication);
            await this.kuduServiceUtility.createPathIfRequired(physicalPath);
            this.virtualApplicationPath = physicalPath;
        }

        webPackage = await FileTransformsUtility.applyTransformations(webPackage, this.taskParams);
        this.taskParams.Package = new Package(webPackage);

        var updateApplicationSetting = ParameterParser.parse(removeRunFromZipAppSetting)
        var deleteApplicationSetting = ParameterParser.parse(deleteOldRunFromZipAppSetting)
        await this.appServiceUtility.updateAndMonitorAppSettings(updateApplicationSetting, deleteApplicationSetting);
        
        if(deployUtility.canUseWebDeploy(this.taskParams.UseWebDeploy)) {
            let deploymentMethodtelemetry = '{"deploymentMethod":"Web Deploy"}';
            console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);

            tl.debug("Performing the deployment of webapp.");
            
            if(!tl.osType().match(/^Win/)) {
                throw Error(tl.loc("PublishusingwebdeployoptionsaresupportedonlywhenusingWindowsagent"));
            }
    
            var msDeployPublishingProfile = await this.appServiceUtility.getWebDeployPublishingProfile();
            await WebDeployUtility.publishUsingWebDeploy(this.taskParams,
                WebDeployUtility.constructWebDeployArguments(this.taskParams, msDeployPublishingProfile), this.appServiceUtility
            );
            
        }
        else {
            let deploymentMethodtelemetry = '{"deploymentMethod":"Zip API"}';
            console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);

            tl.debug("Initiated deployment via kudu service for webapp package : ");
            await this.kuduServiceUtility.deployWebPackage(webPackage, physicalPath, this.taskParams.VirtualApplication, this.taskParams.TakeAppOfflineFlag);
        }        

        await this.PostDeploymentStep();
    }
}