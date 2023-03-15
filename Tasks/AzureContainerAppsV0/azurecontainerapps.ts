import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';
import { AzureAuthenticationHelper } from './src/AzureAuthenticationHelper';
import { ContainerAppHelper } from './src/ContainerAppHelper';
import { ContainerRegistryHelper } from './src/ContainerRegistryHelper';
import { TelemetryHelper } from './src/TelemetryHelper';
import { Utility } from './src/Utility';

const util = new Utility();

export class azurecontainerapps {

    public static async runMain(): Promise<void> {
        let disableTelemetry = tl.getBoolInput('disableTelemetry', false);

        // Set up TelemetryHelper for managing telemetry calls
        const telemetryHelper: TelemetryHelper = new TelemetryHelper(disableTelemetry);

        // Set up AzureAuthenticationHelper for managing logging in and out of Azure CLI using provided service connection
        const authHelper: AzureAuthenticationHelper = new AzureAuthenticationHelper();

        // Set up ContainerAppHelper for managing calls around the Container App
        const appHelper: ContainerAppHelper = new ContainerAppHelper(disableTelemetry);
        try {
            // Set up localization
            tl.setResourcePath(path.join(__dirname, 'task.json'));

            const cwd: string = tl.getPathInput('cwd', true, false);
            tl.mkdirP(cwd);
            tl.cd(cwd);

            // Set build variables used later for default values
            const buildId = tl.getVariable('Build.BuildId');
            const buildNumber = tl.getVariable('Build.BuildNumber');

            // Set up array to store optional arguments for the 'az containerapp up' command
            const optionalCmdArgs: string[] = [];

            // Get the path to the application source to build and run, if provided
            const appSourcePath: string = tl.getInput('appSourcePath', false);

            // Get the name of the ACR instance to push images to, if provided
            const acrName: string = tl.getInput('acrName', false);

            // Get the previously built image to deploy, if provided
            let imageToDeploy: string = tl.getInput('imageToDeploy', false);

            // Ensure that acrName is also provided if appSourcePath is provided
            if (!util.isNullOrEmpty(appSourcePath) && util.isNullOrEmpty(acrName)) {
                tl.error(tl.loc('MissingAcrNameMessage'));
                throw Error(tl.loc('MissingAcrNameMessage'));
            }

            // Ensure that if neither appSourcePath nor acrName are provided that imageToDeploy is provided
            if (util.isNullOrEmpty(appSourcePath) && util.isNullOrEmpty(acrName) && util.isNullOrEmpty(imageToDeploy)) {
                tl.error(tl.loc('MissingImageToDeployMessage'));
                throw Error(tl.loc('MissingImageToDeployMessage'));
            }

            // Install the pack CLI
            await appHelper.installPackCliAsync();

            // Set the Azure CLI to dynamically install missing extensions
            util.setAzureCliDynamicInstall();

            // Log in to Azure with the service connection provided
            const connectedService: string = tl.getInput('connectedServiceNameARM', true);
            authHelper.loginAzureRM(connectedService);

            const acrUsername: string = tl.getInput('acrUsername', false);
            const acrPassword: string = tl.getInput('acrPassword', false);

            // Login to ACR if credentials were provided
            if (!util.isNullOrEmpty(acrName) && !util.isNullOrEmpty(acrUsername) && !util.isNullOrEmpty(acrPassword)) {
                console.log(tl.loc('AcrUsernamePasswordLoginMessage'));
                new ContainerRegistryHelper().loginAcrWithUsernamePassword(acrName, acrUsername, acrPassword);
                optionalCmdArgs.push(
                    `--registry-server ${acrName}.azurecr.io`,
                    `--registry-username ${acrUsername}`,
                    `--registry-password ${acrPassword}`);
            }

            // Login to ACR with access token if no credentials were provided
            if (!util.isNullOrEmpty(acrName) && (util.isNullOrEmpty(acrUsername) || util.isNullOrEmpty(acrPassword))) {
                console.log(tl.loc('AcrAccessTokenLoginMessage'));
                await new ContainerRegistryHelper().loginAcrWithAccessTokenAsync(acrName);
            }

            // Signals whether the Oryx builder should be used to create a runnable application image
            let shouldUseBuilder: boolean = false;

            // Signals whether an image will be created locally and pushed to ACR to use for the Container App
            let shouldBuildAndPushImage = !util.isNullOrEmpty(appSourcePath);

            // Get Dockerfile to build, if provided, or check if one exists at the root of the provided application
            let dockerfilePath: string = tl.getInput('dockerfilePath', false);
            if (shouldBuildAndPushImage) {
                if (util.isNullOrEmpty(dockerfilePath)) {
                    console.log(tl.loc('CheckForAppSourceDockerfileMessage', appSourcePath));
                    const rootDockerfilePath = path.join(appSourcePath, 'Dockerfile');
                    if (fs.existsSync(rootDockerfilePath)) {
                        console.log(tl.loc('FoundAppSourceDockerfileMessage', rootDockerfilePath));
                        dockerfilePath = rootDockerfilePath;
                    } else {
                        // No Dockerfile found or provided, use the builder
                        shouldUseBuilder = true;
                    }
                } else {
                    dockerfilePath = path.join(appSourcePath, dockerfilePath);
                }
            }

            // Get the name of the image to build if it was provided, or generate it from build variables
            let imageToBuild: string = tl.getInput('imageToBuild', false);
            if (util.isNullOrEmpty(imageToBuild)) {
                imageToBuild = `${acrName}.azurecr.io/ado-task/container-app:${buildId}.${buildNumber}`;
                console.log(tl.loc('DefaultImageToBuildMessage', imageToBuild));
            }

            // Get the name of the image to deploy if it was provided, or set it to the value of 'imageToBuild'
            if (util.isNullOrEmpty(imageToDeploy)) {
                imageToDeploy = imageToBuild;
                console.log(tl.loc('DefaultImageToDeployMessage', imageToDeploy));
            }

            // Get the Container App name if it was provided, or generate it from build variables
            let containerAppName: string = tl.getInput('containerAppName', false);
            if (util.isNullOrEmpty(containerAppName)) {
                containerAppName = `ado-task-app-${buildId}-${buildNumber}`;
                console.log(tl.loc('DefaultContainerAppNameMessage', containerAppName));
            }

            // Get the resource group to deploy to if it was provided, or generate it from the Container App name
            let resourceGroup: string = tl.getInput('resourceGroup', false);
            if (util.isNullOrEmpty(resourceGroup)) {
                resourceGroup = `${containerAppName}-rg`;
                console.log(tl.loc('DefaultResourceGroupMessage', resourceGroup));
            }

            // Get the Container App environment if provided
            const containerAppEnvironment: string = tl.getInput('containerAppEnvironment', false);
            if (!util.isNullOrEmpty(containerAppEnvironment)) {
                console.log(tl.loc('ContainerAppEnvironmentUsedMessage', containerAppEnvironment));
                optionalCmdArgs.push(`--environment ${containerAppEnvironment}`);
            }

            // Get the runtime stack if provided, or determine it using Oryx
            let runtimeStack: string = tl.getInput('runtimeStack', false);
            if (util.isNullOrEmpty(runtimeStack) && shouldUseBuilder) {
                runtimeStack = await appHelper.determineRuntimeStackAsync(appSourcePath);
                console.log(tl.loc('DefaultRuntimeStackMessage', runtimeStack));
            }

            // Get the target port if provided, or determine it based on the application type
            let targetPort: string = tl.getInput('targetPort', false);
            if (util.isNullOrEmpty(targetPort) && shouldUseBuilder) {
                if (!util.isNullOrEmpty(runtimeStack) && runtimeStack.startsWith('python:')) {
                    targetPort = '80';
                } else {
                    targetPort = '8080';
                }

                console.log(tl.loc('DefaultTargetPortMessage', targetPort));
            }

            // Add the target port to the optional arguments array
            if (!util.isNullOrEmpty(targetPort)) {
                optionalCmdArgs.push(`--target-port ${targetPort}`);
            }

            // Set Container App deployment location, if provided
            const location: string = tl.getInput('location', false);
            if (!util.isNullOrEmpty(location)) {
                optionalCmdArgs.push(`--location ${location}`);
            }

            // Add user specified environment variables
            const environmentVariables: string = tl.getInput('environmentVariables', false);
            if (!util.isNullOrEmpty(environmentVariables)) {
                optionalCmdArgs.push(`--env-vars ${environmentVariables}`);
            }

            // If using the Oryx++ Builder to produce an image, create a runnable application image
            if (shouldUseBuilder) {
                console.log(tl.loc('CreateImageWithBuilderMessage'));

                // Set the Oryx++ Builder as the default builder locally
                appHelper.setDefaultBuilder();

                // Create a runnable application image
                appHelper.createRunnableAppImage(imageToDeploy, appSourcePath, runtimeStack);

                // If telemetry is enabled, log that the builder scenario was targeted for this task
                telemetryHelper.setBuilderScenario();
            }

            // If a Dockerfile was found or provided, create a runnable application image from that
            if (!util.isNullOrEmpty(dockerfilePath) && shouldBuildAndPushImage) {
                console.log(tl.loc('CreateImageWithDockerfileMessage', dockerfilePath));
                appHelper.createRunnableAppImageFromDockerfile(imageToDeploy, appSourcePath, dockerfilePath);

                // If telemetry is enabled, log that the Dockerfile scenario was targeted for this task
                telemetryHelper.setDockerfileScenario();
            }

            // Push image to Azure Container Registry
            if (shouldBuildAndPushImage) {
                new ContainerRegistryHelper().pushImageToAcr(imageToDeploy);
            } else {
                // If telemetry is enabled, log that the previously built image scenario was targeted for this task
                telemetryHelper.setImageScenario();
            }

            // Create or update Azure Container App
            appHelper.createOrUpdateContainerApp(containerAppName, resourceGroup, imageToDeploy, optionalCmdArgs);
            telemetryHelper.setSuccessfulResult();
        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
            telemetryHelper.setFailedResult(err.message);
        } finally {
            // Logout of Azure if logged in during this task session
            authHelper.logoutAzure();

            // If telemetry is enabled, will log metadata for this task run
            telemetryHelper.sendLogs();
        }
    }
}

azurecontainerapps.runMain();
