import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import tl = require('azure-pipelines-task-lib/task');
import { PackageType } from 'azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/packageUtility';
import path = require('path');
import * as ParameterParser from 'azure-pipelines-tasks-azurermdeploycommon-v3/operations/ParameterParserUtility'
import { TaskParameters, DeploymentType } from '../taskparameters';

var webCommonUtility = require('azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/utility.js');
var zipUtility = require('azure-pipelines-tasks-azurermdeploycommon-v3/webdeployment-common/ziputility.js');

const linuxFunctionStorageSetting: string = '-WEBSITES_ENABLE_APP_SERVICE_STORAGE true';
const linuxFunctionRuntimeSettingName: string = '-FUNCTIONS_WORKER_RUNTIME ';
const premiumPlanRunsFromPackage: string = ' -WEBSITE_RUN_FROM_PACKAGE 1';
const removeRunFromZipAppSetting: string = ' -WEBSITE_RUN_FROM_PACKAGE 0';

const linuxFunctionRuntimeSettingValue = new Map([
    [ 'DOCKER|microsoft/azure-functions-dotnet-core2.0:2.0', 'dotnet ' ],
    [ 'DOCKER|microsoft/azure-functions-node8:2.0', 'node ' ],
    [ 'DOCKER|microsoft/azure-functions-python3.6:2.0', 'python '],
    [ 'DOTNET|2.2', 'dotnet ' ],
    [ 'DOTNET|3.1', 'dotnet ' ],
    [ 'DOTNET|6.0', 'dotnet ' ],
    [ 'DOTNET-ISOLATED|7.0', 'dotnet-isolated '],
    [ 'JAVA|8', 'java ' ],
    [ 'JAVA|11', 'java ' ],
    [ 'NODE|8', 'node ' ],
    [ 'NODE|10', 'node ' ],
    [ 'NODE|12', 'node ' ],
    [ 'NODE|14', 'node ' ],
    [ 'NODE|16', 'node ' ],
    [ 'PYTHON|3.6', 'python '],
    [ 'PYTHON|3.7', 'python '],
    [ 'PYTHON|3.8', 'python '],
    [ 'PYTHON|3.9', 'python ']
]);

export class BuiltInLinuxWebAppDeploymentProvider extends AzureRmWebAppDeploymentProvider {
    private zipDeploymentID: string;

    public async DeployWebAppStep() {
        let packageType = this.taskParams.Package.getPackageType();
        let deploymentMethodtelemetry = '{"deploymentMethod":"Zip Deploy for Linux"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureFunctionAppDeployment]" + deploymentMethodtelemetry);

        tl.debug('Performing Linux built-in package deployment');
        var isNewValueUpdated: boolean = false;
        
        var linuxFunctionRuntimeSetting = "";
        if(this.taskParams.RuntimeStack && linuxFunctionRuntimeSettingValue.get(this.taskParams.RuntimeStack)) {
            linuxFunctionRuntimeSetting = linuxFunctionRuntimeSettingName + linuxFunctionRuntimeSettingValue.get(this.taskParams.RuntimeStack);
        }
        var linuxFunctionAppSetting = linuxFunctionRuntimeSetting + linuxFunctionStorageSetting;
        if(this.taskParams.DeploymentType != DeploymentType.zipDeploy) {
            linuxFunctionAppSetting = linuxFunctionAppSetting + premiumPlanRunsFromPackage;
        }
        else if(this.taskParams.DeploymentType == DeploymentType.zipDeploy) {
            linuxFunctionAppSetting = linuxFunctionAppSetting + removeRunFromZipAppSetting;
        }
        var customApplicationSetting = ParameterParser.parse(linuxFunctionAppSetting);
        isNewValueUpdated = await this.appServiceUtility.updateAndMonitorAppSettings(customApplicationSetting);
        
        if(!isNewValueUpdated) {
            await this.kuduServiceUtility.warmpUp();
        }
        
        switch(packageType){
            case PackageType.folder:
                let tempPackagePath = webCommonUtility.generateTemporaryFolderOrZipPath(tl.getVariable('AGENT.TEMPDIRECTORY'), false);
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

            default:
                throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', this.taskParams.Package.getPath()));
        }


        await this.PostDeploymentStep();
    }

    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            await super.UpdateDeploymentStatus(isDeploymentSuccess);
            if(this.zipDeploymentID && this.activeDeploymentID && isDeploymentSuccess) {
                await this.kuduServiceUtility.postZipDeployOperation(this.zipDeploymentID, this.activeDeploymentID);
            }
        }
    }
}