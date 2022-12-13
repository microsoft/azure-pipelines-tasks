import path = require('path');
import { v4 as uuidv4 } from 'uuid';
import { Package, PackageType } from 'azure-pipelines-tasks-webdeployment-common/packageUtility';
import { Actions, DeploymentType, TaskParameters } from '../operations/taskparameters';
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
        const azureEndpoint = await new AzureRMEndpoint(this.taskParameters.ConnectedServiceName).getEndpoint();

        //The Azure Spring Cloud parameter can be a resource ID (if selected from the picklist) or
        //a name (if entered manually). This is to avoid requiring the user to enter an otherwise unnecessary user
        //user group name. If we have a name, we need to look up the resource ID.
        var azureSpringCloudResourceId: string;
        if (this.taskParameters.AzureSpringCloud.startsWith('/')) {
            if (this.taskParameters.AzureSpringCloud.includes('..')){{
                throw Error(tl.loc('InvalidAzureSpringAppsResourceId', 'this.taskParameters.AzureSpringCloud'));
            }}
            azureSpringCloudResourceId = this.taskParameters.AzureSpringCloud;
        } else {
            azureSpringCloudResourceId = await AzureResourceFilterUtility.getAzureSpringCloudResourceId(azureEndpoint, this.taskParameters.AzureSpringCloud);
        }

        this.azureSpringCloud = new AzureSpringCloud(azureEndpoint, azureSpringCloudResourceId);
    }

    public async DeployAppStep() {
        switch (this.taskParameters.Action) {

            case Actions.deploy: {
                if (DeploymentType.isArtifacts(this.taskParameters.DeploymentType)) {
                    await this.performDeployAction();
                } else if (this.taskParameters.DeploymentType == DeploymentType.customContainer) {
                    await this.performDeployContainerAction();
                } else {
                    throw Error(tl.loc('UnsupportedSourceType', this.taskParameters.DeploymentType));
                }
                break;
            }

            case Actions.setProduction: {
                var deploymentName: string | undefined;
                await this.performSetProductionAction();
                break;
            }

            case Actions.deleteStagingDeployment: {
                await this.performDeleteStagingDeploymentAction();
                break;
            }

            default:
                throw Error(tl.loc('UnknownOrUnsupportedAction', this.taskParameters.Action));
        }
    }

    private async performDeleteStagingDeploymentAction() {
        tl.debug('Delete staging deployment action');
        const deploymentName = await this.azureSpringCloud.getInactiveDeploymentName(this.taskParameters.AppName);
        if (deploymentName) {
            await this.azureSpringCloud.deleteDeployment(this.taskParameters.AppName, deploymentName);
        } else {
            throw Error(tl.loc('NoStagingDeploymentFound'));
        }
        return deploymentName;
    }

    private async performSetProductionAction() {
        tl.debug('Set production action for app ' + this.taskParameters.AppName);
        var deploymentName: string;
        if (this.taskParameters.UseStagingDeployment) {
            tl.debug('Targeting inactive deployment');
            deploymentName = await this.azureSpringCloud.getInactiveDeploymentName(this.taskParameters.AppName);
            if (!deploymentName) { //If no inactive deployment exists, we cannot continue as instructed.
                throw Error(tl.loc('NoStagingDeploymentFound'));
            }
        }
        else {
            //Verify that the named deployment actually exists.
            deploymentName = this.taskParameters.DeploymentName;
            let existingStagingDeploymentName: string = await this.azureSpringCloud.getInactiveDeploymentName(this.taskParameters.AppName);
            if (deploymentName != existingStagingDeploymentName) {
                throw Error(tl.loc('StagingDeploymentWithNameDoesntExist', deploymentName));
            }
        }

        await this.azureSpringCloud.setActiveDeployment(this.taskParameters.AppName, deploymentName);
    }

    private async performDeployAction() {
        tl.debug('Deployment action');

        var sourceType: string = this.determineSourceType(this.taskParameters.Package);

        //If uploading a source folder, compress to tar.gz file.
        var fileToUpload: string = sourceType == SourceType.SOURCE_DIRECTORY ?
            await this.compressSourceDirectory(this.taskParameters.Package.getPath()) :
            this.taskParameters.Package.getPath();

        const {deploymentName, createDeployment} = await this.chooseDeployment();
        
        // Determine the sku of the Azure Spring Cloud
        const serviceSkuTier = await this.azureSpringCloud.getServiceSkuTier();
        try {
            if (serviceSkuTier == "Standard" || serviceSkuTier == "Basic") {
                await this.azureSpringCloud.deploy(fileToUpload, sourceType, this.taskParameters.AppName,
                    deploymentName, createDeployment, this.taskParameters.RuntimeVersion, this.taskParameters.JvmOptions, 
                    this.taskParameters.EnvironmentVariables, this.taskParameters.DotNetCoreMainEntryPath, this.taskParameters.Version);
            } else if (serviceSkuTier == "Enterprise") {
                await this.azureSpringCloud.deployWithBuildService(fileToUpload, sourceType, this.taskParameters.AppName, 
                    deploymentName, createDeployment, this.taskParameters.RuntimeVersion, this.taskParameters.JvmOptions,
                    this.taskParameters.EnvironmentVariables, this.taskParameters.DotNetCoreMainEntryPath, this.taskParameters.Version, this.taskParameters.Builder);
            } else {
                throw Error(tl.loc('ServiceSkuNotRecognizable', serviceSkuTier));
            }
        } catch (error) {
            throw error;
        }
        var testEndpoint = await this.azureSpringCloud.getTestEndpoint(this.taskParameters.AppName, deploymentName);
        tl.setVariable(OUTPUT_VARIABLE_TEST_ENDPOINT, testEndpoint);
        return deploymentName;
    }

    private async performDeployContainerAction() {
        tl.debug('Deployment action');

        const {deploymentName, createDeployment} = await this.chooseDeployment();

        try {
            await this.azureSpringCloud.deployCustomContainer(this.taskParameters.AppName, deploymentName, createDeployment,
                this.taskParameters.RegistryServer, this.taskParameters.RegistryUsername, this.taskParameters.RegistryPassword,
                this.taskParameters.ImageName, this.taskParameters.ImageCommand, this.taskParameters.ImageArgs, this.taskParameters.ImageLanguageFramework,
                this.taskParameters.EnvironmentVariables, this.taskParameters.Version);
        } catch (error) {
            throw error;
        }
        var testEndpoint = await this.azureSpringCloud.getTestEndpoint(this.taskParameters.AppName, deploymentName);
        tl.setVariable(OUTPUT_VARIABLE_TEST_ENDPOINT, testEndpoint);
        return deploymentName;
    }

    private async chooseDeployment() {
        var deploymentName: string;
        var createDeployment = false;
        if (this.taskParameters.UseStagingDeployment) {
            deploymentName = await this.azureSpringCloud.getInactiveDeploymentName(this.taskParameters.AppName);
            if (!deploymentName) { //If no inactive deployment exists
                tl.debug('No inactive deployment exists');
                if (this.taskParameters.CreateNewDeployment) {
                    tl.debug('New deployment will be created');
                    createDeployment = true;
                    deploymentName = this.defaultInactiveDeploymentName; //Create a new deployment with the default name.
                } else
                    throw Error(tl.loc('NoStagingDeploymentFound'));
            }
        } else { //Deploy to deployment with specified name
            tl.debug('Deploying with specified name.');
            deploymentName = this.taskParameters.DeploymentName;
            var deploymentNames = await this.azureSpringCloud.getAllDeploymentNames(this.taskParameters.AppName);
            if (!deploymentNames || !deploymentNames.includes(deploymentName)) {
                tl.debug(`Deployment ${deploymentName} does not exist`);
                if (this.taskParameters.CreateNewDeployment) {
                    if (deploymentNames.length > 1) {
                        throw Error(tl.loc('TwoDeploymentsAlreadyExistCannotCreate', deploymentName));
                    } else {
                        tl.debug('Deployment will be created.');
                        createDeployment = true;
                    }
                } else {
                    throw Error(tl.loc('DeploymentDoesntExist', deploymentName));
                }
            }
        }
        return { deploymentName, createDeployment };
    }

    /**
     * Compresses sourceDirectoryPath into a tar.gz
     * @param sourceDirectoryPath 
     */
    async compressSourceDirectory(sourceDirectoryPath: string): Promise<string> {
        const fileName = `${uuidv4()}.tar.gz`;
        console.log(tl.loc('CompressingSourceDirectory', sourceDirectoryPath, fileName));
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
                throw Error(tl.loc('UnsupportedSourceType', pkg.getPath()));
        }
        return sourceType;
    }
}