console.log('3a');
import path = require('path');
console.log('3a1');
import { Package, PackageType } from 'webdeployment-common-v2/packageUtility';
console.log('3a2');
import { TaskParameters } from '../operations/taskparameters';
console.log('3a3');
import { AzureSpringCloud } from './azure-arm-spring-cloud';
console.log('3a4');
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
console.log('3a5');
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
console.log('3a');
import tl = require('azure-pipelines-task-lib/task');

console.log('3b')
export class AzureSpringCloudDeploymentProvider {
    protected taskParameters: TaskParameters;
    protected azureEndpoint: AzureEndpoint;
    protected azureSpringCloud: AzureSpringCloud;

    constructor(taskParameters: TaskParameters) {
        this.taskParameters = taskParameters;
    }

    public async PreDeploymentStep() {
        console.log('3c')
        console.log('CSN: '+this.taskParameters.ConnectedServiceName);
        console.log(this.taskParameters);
        this.azureEndpoint = await new AzureRMEndpoint(this.taskParameters.ConnectedServiceName).getEndpoint();
        console.log('3c-a')
        this.azureSpringCloud = new AzureSpringCloud(this.azureEndpoint, this.taskParameters.SpringCloudResourceId);
        console.log('3d')
    }

    public async PostDeploymentStep() {
    }

    public async UpdateDeploymentStatus(isDeploymentSuccessful: boolean) {

    }

    public async DeployAppStep() {
        console.log('3e');
        if (this.taskParameters.JarPath === null){
            throw('Only Jar files are currently supported.');
        }
        console.log('3f');
        this.azureSpringCloud.deployJar(this.taskParameters.JarPath, this.taskParameters.AppName, this.taskParameters.DeploymentName);
        console.log('3g');
    }
}