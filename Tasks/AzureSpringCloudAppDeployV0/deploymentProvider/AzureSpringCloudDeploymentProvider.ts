import path = require('path');
import { TaskParameters } from '../operations/taskparameters';
import { AzureResourceFilterUtility } from '../operations/AzureResourceFilterUtility';
import { AzureSpringCloud } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-spring-cloud';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import tl = require('azure-pipelines-task-lib/task');


export class AzureSpringCloudDeploymentProvider{
    protected taskParameters: TaskParameters;
    protected azureEndpoint: AzureEndpoint;

    constructor(taskParameters: TaskParameters){
        this.taskParameters = taskParameters;
    }

    public async PreDeploymentStep() {
        this.azureEndpoint = await new AzureRMEndpoint(this.taskParameters.ConnectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureSpringCloudDeploy', this.taskParameters.AppName));
        this.taskParameters.ResourceGroupName = await AzureResourceFilterUtility.getResourceGroupName(this.azureEndpoint, this.taskParameters.SpringCloudServiceName);

    }

    public async PostDeploymentStep() {
    }

    public async UpdateDeploymentStatus(isDeploymentSuccessful: boolean){

    }

    public async DeployAppStep(){
    }


}