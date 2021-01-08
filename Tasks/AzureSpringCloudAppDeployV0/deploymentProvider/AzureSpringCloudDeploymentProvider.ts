import path = require('path');
import { Package, PackageType } from 'webdeployment-common-v2/packageUtility';
import { TaskParameters } from '../operations/taskparameters';
import { AzureResourceFilterUtility } from '../operations/AzureResourceFilterUtility';
import { AzureSpringCloud } from './azure-arm-spring-cloud';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import tl = require('azure-pipelines-task-lib/task');


export class AzureSpringCloudDeploymentProvider {
    protected taskParameters: TaskParameters;
    protected azureEndpoint: AzureEndpoint;
    protected azureSpringCloud: AzureSpringCloud;

    constructor(taskParameters: TaskParameters) {
        this.taskParameters = taskParameters;
    }

    public async PreDeploymentStep() {
        this.azureEndpoint = await new AzureRMEndpoint(this.taskParameters.ConnectedServiceName).getEndpoint();
        console.log(tl.loc('GotconnectiondetailsforazureSpringCloudDeploy', this.taskParameters.AppName));
        this.azureSpringCloud = new AzureSpringCloud(this.azureEndpoint, this.taskParameters.SpringCloudResourceId);

        let packageType = this.taskParameters.Package.getPackageType();
        switch (packageType) {
            case PackageType.jar:
                if (this.taskParameters.Package.isFolder()){
                    tl.error("A folder cannot be deployed in a Jar deployment: "+this.taskParameters.Package.getPath);
                    throw new Error(tl.loc('Invalidwebapppackageorfolderpathprovided', this.taskParameters.Package.getPath()));
                }
                tl.debug("Initiated jar deployment to Azure Spring Cloud: " + this.taskParameters.Package.getPath());
            break;

        }
    }

    public async PostDeploymentStep() {
    }

    public async UpdateDeploymentStatus(isDeploymentSuccessful: boolean) {

    }

    public async DeployAppStep() {
        let packageType = this.taskParameters.Package.getPackageType();
    }


}