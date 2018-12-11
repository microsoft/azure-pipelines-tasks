import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('vsts-task-lib/task');
import { PackageType } from 'azurermdeploycommon/webdeployment-common/packageUtility';
import path = require('path');

var webCommonUtility = require('azurermdeploycommon/webdeployment-common/utility.js');
var deployUtility = require('azurermdeploycommon/webdeployment-common/utility.js');
var zipUtility = require('azurermdeploycommon/webdeployment-common/ziputility.js');

export class BuiltInLinuxWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider {
    private zipDeploymentID: string;

    public async DeployWebAppStep() {
        let packageType = this.taskParams.Package.getPackageType();
        let deploymentMethodtelemetry = packageType === PackageType.war ? '{"deploymentMethod":"War Deploy"}' : '{"deploymentMethod":"Zip Deploy"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);
        
        tl.debug('Performing Linux built-in package deployment');
        
        await this.kuduServiceUtility.warmpUp();
        
        switch(packageType){
            case PackageType.folder:
                let tempPackagePath = deployUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
                let archivedWebPackage = await zipUtility.archiveFolder(this.taskParams.Package.getPath(), "", tempPackagePath);
                tl.debug("Compressed folder into zip " +  archivedWebPackage);
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(archivedWebPackage);
            break;
            case PackageType.zip:
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(this.taskParams.Package.getPath());
            break;

            case PackageType.jar:
                tl.debug("Initiated deployment via kudu service for webapp jar package : "+ this.taskParams.Package.getPath());
                var folderPath = await webCommonUtility.generateTemporaryFolderForDeployment(false, this.taskParams.Package.getPath(), PackageType.jar);
                var jarName = webCommonUtility.getFileNameFromPath(this.taskParams.Package.getPath(), ".jar");
                var destRootPath = "/home/site/wwwroot/";
                var script = 'java -jar "' + destRootPath + jarName + '.jar' + '" --server.port=80';
                var initScriptFileName = "startupscript_" + jarName + ".sh";
                var initScriptFile = path.join(folderPath, initScriptFileName);
                var destInitScriptPath = destRootPath + initScriptFileName;
                if(!this.taskParams.AppSettings) {
                    this.taskParams.AppSettings = "-INIT_SCRIPT " + destInitScriptPath;
                }
                if(this.taskParams.AppSettings.indexOf("-INIT_SCRIPT") < 0) {
                    this.taskParams.AppSettings += " -INIT_SCRIPT " + destInitScriptPath;
                }
                this.taskParams.AppSettings = this.taskParams.AppSettings.trim();
                tl.writeFile(initScriptFile, script, { encoding: 'utf8' });
                var output = await webCommonUtility.archiveFolderForDeployment(false, folderPath);
                var webPackage = output.webDeployPkg;
                tl.debug("Initiated deployment via kudu service for webapp jar package : "+ webPackage);
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingZipDeploy(webPackage);
            break;

            case PackageType.war:
                tl.debug("Initiated deployment via kudu service for webapp war package : "+ this.taskParams.Package.getPath());
                var warName = webCommonUtility.getFileNameFromPath(this.taskParams.Package.getPath(), ".war");
                this.zipDeploymentID = await this.kuduServiceUtility.deployUsingWarDeploy(this.taskParams.Package.getPath(), 
                { slotName: this.appService.getSlot() }, warName);
            break;

            default:
                throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', this.taskParams.Package.getPath()));
        }

        await this.appServiceUtility.updateStartupCommandAndRuntimeStack(this.taskParams.RuntimeStack, this.taskParams.StartupCommand);

        await this.PostDeploymentStep();
    }

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            if(this.zipDeploymentID && this.activeDeploymentID && isDeploymentSuccess) {
                await this.kuduServiceUtility.postZipDeployOperation(this.zipDeploymentID, this.activeDeploymentID);
            }
            
            await super.UpdateDeploymentStatus(isDeploymentSuccess);
        }
    }
}