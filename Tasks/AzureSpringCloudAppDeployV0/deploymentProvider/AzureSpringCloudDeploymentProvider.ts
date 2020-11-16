import path = require('path');
import { TaskParameters } from '../operations/taskparameters';

export class AzureSpringCloudDeploymentProvider{
    protected taskParameters: TaskParameters;

    constructor(taskParameters: TaskParameters){
        this.taskParameters = taskParameters;
    }

    public async PreDeploymentStep() {
    }

    public async PostDeploymentStep() {
    }

    public async UpdateDeploymentStatus(isDeploymentSuccessful: boolean){

    }

    public async DeployAppStep(){
    }


}