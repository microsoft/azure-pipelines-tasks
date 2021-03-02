import path = require('path');
import { Package, PackageType } from 'webdeployment-common-v2/packageUtility';
import { TaskParameters } from '../operations/taskparameters';
import { AzureSpringCloud } from './azure-arm-spring-cloud';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azureModels';
import tl = require('azure-pipelines-task-lib/task');

const OUTPUT_VARIABLE_TEST_ENDPOINT='testEndpoint';

export class AzureSpringCloudDeploymentProvider {

    defaultInactiveDeploymentName = 'staging';

    protected taskParameters: TaskParameters;
    protected azureEndpoint: AzureEndpoint;
    protected azureSpringCloud: AzureSpringCloud;

    constructor(taskParameters: TaskParameters) {
        this.taskParameters = taskParameters;
    }

    public async PreDeploymentStep() {
        this.azureEndpoint = await new AzureRMEndpoint(this.taskParameters.ConnectedServiceName).getEndpoint();
        this.azureSpringCloud = new AzureSpringCloud(this.azureEndpoint, this.taskParameters.SpringCloudResourceId);
    }

    public async DeployAppStep() {
        switch (this.taskParameters.Action) {

            case 'Deploy': {
                tl.debug('Deployment action');
                if (this.taskParameters.Package.getPackageType() != PackageType.jar) {
                    throw ('Only Jar files are currently supported.');
                }

                var deploymentName: string;
                var createDeployment = false;
                if (this.taskParameters.TargetInactive) { 
                    deploymentName = await this.azureSpringCloud.getInactiveDeploymentName(this.taskParameters.AppName);
                    if (!deploymentName) { //If no inactive deployment exists
                        if (this.taskParameters.CreateNewDeployment){
                            createDeployment = true;
                            deploymentName = this.defaultInactiveDeploymentName; //Create a new deployment with the default name.
                        } else throw ('No staging deployment found');
                    }
                } else { //Deploy to deployment with specified name
                    console.debug('Deploying with specified name.')
                    deploymentName = this.taskParameters.DeploymentName;
                    var deploymentNames = await this.azureSpringCloud.getAllDeploymentNames(this.taskParameters.AppName);
                    if (!deploymentNames || !deploymentNames.includes(deploymentName)){
                        tl.debug(`Deployment ${deploymentName} does not exist`);
                        if (this.taskParameters.CreateNewDeployment){
                            tl.debug('Deployment will be created.');
                            createDeployment = true;
                        } else {
                            throw (`Deployment with name ${deploymentName} does not exist. Unable to proceed.`)
                        }
                       
                    }
                }

                this.azureSpringCloud.deployJar(this.taskParameters.Package.getPath(), this.taskParameters.AppName,
                    deploymentName, createDeployment, this.taskParameters.RuntimeVersion, this.taskParameters.JvmOptions, this.taskParameters.EnvironmentVariables);
                var testEndpoint = await this.azureSpringCloud.getTestEndpoint(this.taskParameters.AppName, deploymentName);
                tl.setVariable(OUTPUT_VARIABLE_TEST_ENDPOINT, testEndpoint);
                break;
            }

            case 'Set Production': {
                tl.debug('Set production action for app ' + this.taskParameters.AppName);
                var deploymentName: string;
                if (this.taskParameters.TargetInactive) {
                    tl.debug('Targeting inactive deployment');
                    deploymentName = await this.azureSpringCloud.getInactiveDeploymentName(this.taskParameters.AppName);
                    if (!deploymentName) { //If no inactive deployment exists, we cannot continue as instructed.
                        throw 'Unable to set staging deployment to production: no staging deployment found.';
                    }
                } 
                else deploymentName = this.taskParameters.DeploymentName;

                this.azureSpringCloud.setActiveDeployment(this.taskParameters.AppName, deploymentName);
                break;
            }

            case 'Delete Staging Deployment': {
                tl.debug('Delete staging deployment action');
                var deploymentName = await this.azureSpringCloud.getInactiveDeploymentName(this.taskParameters.AppName);
                if (deploymentName) {
                    this.azureSpringCloud.deleteDeployment(this.taskParameters.AppName, deploymentName);
                } else {
                    throw 'No inactive deployment found for app ' + this.taskParameters.AppName;
                }

                break;
            }

            default:
                throw ('Unknown or unsupported action: ' + this.taskParameters.Action);
        }
    }
}