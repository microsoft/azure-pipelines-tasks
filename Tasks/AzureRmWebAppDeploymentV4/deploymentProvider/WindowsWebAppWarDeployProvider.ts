import { AzureRmWebAppDeploymentProvider } from './AzureRmWebAppDeploymentProvider';
import { addReleaseAnnotation } from '../operations/ReleaseAnnotationUtility';
import tl = require('azure-pipelines-task-lib/task');
var webCommonUtility = require('azure-pipelines-tasks-webdeployment-common-v4/utility.js');


export class WindowsWebAppWarDeployProvider extends AzureRmWebAppDeploymentProvider{
    
    private zipDeploymentID: string;

    public async DeployWebAppStep() {
        let deploymentMethodtelemetry = '{"deploymentMethod":"War Deploy"}';
        console.log("##vso[telemetry.publish area=TaskDeploymentMethod;feature=AzureWebAppDeployment]" + deploymentMethodtelemetry);

        tl.debug("Initiated deployment via kudu service for webapp war package : "+ this.taskParams.Package.getPath());

        await this.kuduServiceUtility.warmpUp();
        
        var warName = webCommonUtility.getFileNameFromPath(this.taskParams.Package.getPath(), ".war");

        this.zipDeploymentID = await this.kuduServiceUtility.deployUsingWarDeploy(this.taskParams.Package.getPath(), 
            { slotName: this.appService.getSlot() }, warName);
       
        await this.PostDeploymentStep();
    }
    
    public async UpdateDeploymentStatus(isDeploymentSuccess: boolean) {
        if(this.kuduServiceUtility) {
            this.activeDeploymentID =  this.kuduServiceUtility.getDeploymentID();
           
            if(isDeploymentSuccess == false){
                await super.UpdateDeploymentStatus(isDeploymentSuccess);
            }
           else if(this.zipDeploymentID && this.activeDeploymentID && isDeploymentSuccess) {
          
            await addReleaseAnnotation(this.azureEndpoint, this.appService, isDeploymentSuccess);
            let appServiceApplicationUrl: string = await this.appServiceUtility.getApplicationURL(!this.taskParams.isLinuxApp 
                ? this.taskParams.VirtualApplication : null);
            console.log(tl.loc('AppServiceApplicationURL', appServiceApplicationUrl));
            tl.setVariable('AppServiceApplicationUrl', appServiceApplicationUrl);
                await this.kuduServiceUtility.postZipDeployOperation(this.zipDeploymentID, this.activeDeploymentID);
            }
        }
    }
}
