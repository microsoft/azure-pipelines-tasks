import path = require('path');
import { v4 as uuidv4 } from 'uuid';
import { Package, PackageType } from 'webdeployment-common-v2/packageUtility';
import { Actions, TaskParameters } from '../operations/taskparameters';
import { SourceType, AzureSpringCloud } from './azure-arm-spring-cloud';
import { AzureRMEndpoint } from 'azure-pipelines-tasks-azure-arm-rest-v2/azure-arm-endpoint';
import tl = require('azure-pipelines-task-lib/task');
import tar = require('tar');
import { AzureResourceFilterUtility } from '../operations/AzureResourceFilterUtility';

const OUTPUT_VARIABLE_TEST_ENDPOINT = 'testEndpoint';

export class AzureSpringCloudDeploymentProvider {

    defaultInactiveDeploymentName = 'staging';

    protected taskParameters: TaskParameters;
    protected azureSpringCloud: AzureSpringCloud;

    constructor(taskParameters: TaskParameters) {
        this.taskParameters = taskParameters;
    }

    public async PreDeploymentStep() {
        var azureEndpoint = await new AzureRMEndpoint(this.taskParameters.ConnectedServiceName).getEndpoint();

        //The Azure Spring Cloud parameter can be a resource ID (if selected from the picklist) or
        //a name (if entered manually). This is to avoid requiring the user to enter an otherwise unnecessary user
        //user group name. If we have a name, we need to look up the resource ID.
        var azureSpringCloudResourceId: string;
        if (this.taskParameters.AzureSpringCloud.startsWith('/')) {
            azureSpringCloudResourceId = this.taskParameters.AzureSpringCloud;
        } else {
            azureSpringCloudResourceId = await AzureResourceFilterUtility.getAzureSpringCloudResourceId(azureEndpoint, this.taskParameters.AzureSpringCloud);
        }

        this.azureSpringCloud = new AzureSpringCloud(azureEndpoint, azureSpringCloudResourceId);
    }

    public async DeployAppStep() {
        switch (this.taskParameters.Action) {

            case Actions.deploy: {
                tl.debug('Deployment action');


                var sourceType: string = this.determineSourceType(this.taskParameters.Package);

                //If uploading a source folder, compress to tar.gz file.
                var fileToUpload: string = sourceType == SourceType.SOURCE_DIRECTORY ?
                    await this.compressSourceDirectory(this.taskParameters.Package.getPath()) :
                    this.taskParameters.Package.getPath();


                var deploymentName: string;
                var createDeployment = false;
                if (this.taskParameters.TargetInactive) {
                    deploymentName = await this.azureSpringCloud.getInactiveDeploymentName(this.taskParameters.AppName);
                    if (!deploymentName) { //If no inactive deployment exists
                        if (this.taskParameters.CreateNewDeployment) {
                            createDeployment = true;
                            deploymentName = this.defaultInactiveDeploymentName; //Create a new deployment with the default name.
                        } else throw Error ('No staging deployment found');
                    }
                } else { //Deploy to deployment with specified name
                    console.debug('Deploying with specified name.')
                    deploymentName = this.taskParameters.DeploymentName;
                    var deploymentNames = await this.azureSpringCloud.getAllDeploymentNames(this.taskParameters.AppName);
                    if (!deploymentNames || !deploymentNames.includes(deploymentName)) {
                        tl.debug(`Deployment ${deploymentName} does not exist`);
                        if (this.taskParameters.CreateNewDeployment) {
                            tl.debug('Deployment will be created.');
                            createDeployment = true;
                        } else {
                            throw Error(`Deployment with name ${deploymentName} does not exist. Unable to proceed.`)
                        }

                    }
                }
                try {
                    this.azureSpringCloud.deploy(fileToUpload, sourceType, this.taskParameters.AppName,
                        deploymentName, createDeployment, this.taskParameters.RuntimeVersion, this.taskParameters.JvmOptions, this.taskParameters.EnvironmentVariables);
                    } catch (error){
                        throw error;
                    }
                var testEndpoint = await this.azureSpringCloud.getTestEndpoint(this.taskParameters.AppName, deploymentName);
                tl.setVariable(OUTPUT_VARIABLE_TEST_ENDPOINT, testEndpoint);
                break;
            }

            case Actions.setProduction: {
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

            case Actions.deleteStagingDeployment: {
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

    /**
     * Compresses sourceDirectoryPath into a tar.gz
     * @param sourceDirectoryPath 
     */
    async compressSourceDirectory(sourceDirectoryPath: string): Promise<string> {
        var fileName = `${uuidv4()}.tar.gz`;
        console.log(`Compressing source directory ${sourceDirectoryPath} to ${fileName}`);
        await tar.c({
            gzip: true,
            file: fileName,
            sync: true,
            cwd: sourceDirectoryPath,
            onWarn: warning => {
                tl.warning(warning);
            }
        }, ['.']);
        return fileName;
    }

    private determineSourceType(pkg: Package): string {
        var sourceType: string;
        switch (pkg.getPackageType()) {
            case PackageType.folder:
                sourceType = SourceType.SOURCE_DIRECTORY;
                break;
            case PackageType.zip:
                sourceType = SourceType.DOT_NET_CORE_ZIP;
                break;
            case PackageType.jar:
                sourceType = SourceType.JAR;
                break;
            default:
                throw (`Unsupported source type for ${pkg.getPath()}`)
        }
        return sourceType;
    }
}