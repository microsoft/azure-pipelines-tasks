import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import fs = require("fs");
import { Utility } from "./src/Utility";
import { ContainerAppHelper } from "./src/ContainerAppHelper";
import { AzureAuthenticationHelper } from "./src/AzureAuthenticationHelper";
import { ContainerRegistryHelper } from "./src/ContainerRegistryHelper";

export class azurecontainerapps {

    public static async runMain(): Promise<void> {
        // Set up AzureAuthenticationHelper for managing logging in and out of Azure CLI using provided service connection
        var authHelper: AzureAuthenticationHelper = new AzureAuthenticationHelper();
        try {
            var cwd: string = tl.getPathInput("cwd", true, false);
            tl.mkdirP(cwd);
            tl.cd(cwd);

            // Set build variables used later for default values
            var buildId = tl.getVariable("Build.BuildId");
            var buildNumber = tl.getVariable("Build.BuildNumber");

            // Set up array to store optional arguments for the 'az containerapp up' command
            var optionalCmdArgs: string[] = [];

            // Get the path to the application source to build and run
            var appSourcePath: string = tl.getInput("appSourcePath", false);

            // Get the previously built image to deploy
            var imageToDeploy: string = tl.getInput("imageToDeploy", false);

            // Ensure that either the application source or a previously built image is provided, but not both
            if ((!appSourcePath && !imageToDeploy) || (!!appSourcePath && !!imageToDeploy)) {
                tl.error(tl.loc('InvalidArgumentsMessage'));
                throw Error(tl.loc('InvalidArgumentsMessage'));
            }

            // Install the pack CLI
            await new ContainerAppHelper().installPackCliAsync();

            // Set the Azure CLI to dynamically install missing extensions
            new Utility().setAzureCliDynamicInstall();

            // Log in to Azure with the service connection provided
            var connectedService: string = tl.getInput("connectedServiceNameARM", true);
            authHelper.loginAzureRM(connectedService);

            var acrName: string = tl.getInput("acrName", true);
            var acrUsername: string = tl.getInput("acrUsername", false);
            var acrPassword: string = tl.getInput("acrPassword", false);

            // Login to ACR if credentials were provided
            if (!!acrUsername && !!acrPassword) {
                console.log(tl.loc("AcrUsernamePasswordLoginMessage"));
                new ContainerRegistryHelper().loginAcrWithUsernamePassword(acrName, acrUsername, acrPassword);
                optionalCmdArgs.push(
                    `--registry-server ${acrName}.azurecr.io`,
                    `--registry-username ${acrUsername}`,
                    `--registry-password ${acrPassword}`);
            }
            
            // Login to ACR with access token if no credentials were provided
            if (!acrUsername || !acrPassword) {
                console.log(tl.loc("AcrAccessTokenLoginMessage"));
                await new ContainerRegistryHelper().loginAcrWithAccessTokenAsync(acrName);
            }

            // Get Dockerfile to build, if provided, or check if one exists at the root of the provided application
            var dockerfilePath: string = tl.getInput("dockerfilePath", false);
            if (!!appSourcePath && !dockerfilePath) {
                console.log(tl.loc("CheckForAppSourceDockerfileMessage", appSourcePath));
                var rootDockerfilePath = path.join(appSourcePath, "Dockerfile");
                if (fs.existsSync(rootDockerfilePath)) {
                    console.log(tl.loc("FoundAppSourceDockerfileMessage", rootDockerfilePath));
                    dockerfilePath = rootDockerfilePath;
                }
            }

            // Get the name of the image to build if it was provided, or generate it from build variables
            var imageToBuild: string = tl.getInput("imageToBuild", false);
            if (!imageToBuild) {
                imageToBuild = `${acrName}.azurecr.io/ado-task/container-app:${buildId}.${buildNumber}`;
                console.log(tl.loc("DefaultImageToBuildMessage", imageToBuild));
            }

            // Get the name of the image to deploy if it was provided, or set it to the value of 'imageToBuild'
            var shouldBuildAndPushImage = false;
            if (!imageToDeploy) {
                imageToDeploy = imageToBuild;
                shouldBuildAndPushImage = true;
                console.log(tl.loc("DefaultImageToDeployMessage", imageToDeploy));
            }

            // Get the Container App name if it was provided, or generate it from build variables
            var containerAppName: string = tl.getInput("containerAppName", false);
            if (!containerAppName) {
                containerAppName = `ado-task-app-${buildId}-${buildNumber}`;
                console.log(tl.loc("DefaultContainerAppNameMessage", containerAppName));
            }

            // Get the resource group to deploy to if it was provided, or generate it from the Container App name
            var resourceGroup: string = tl.getInput("resourceGroup", false);
            if (!resourceGroup) {
                resourceGroup = `${containerAppName}-rg`;
                console.log(tl.loc("DefaultResourceGroupMessage", resourceGroup));
            }

            // Get the Container App environment if provided 
            var containerAppEnvironment: string = tl.getInput("containerAppEnvironment", false);
            if (!!containerAppEnvironment) {
                console.log(tl.loc("ContainerAppEnvironmentUsedMessage", containerAppEnvironment));
                optionalCmdArgs.push(`--environment ${containerAppEnvironment}`);
            }

            // Get the runtime stack if provided, or determine it using Oryx
            var runtimeStack: string = tl.getInput("runtimeStack", false);
            if (!runtimeStack && shouldBuildAndPushImage) {
                runtimeStack = await new ContainerAppHelper().determineRuntimeStackAsync(appSourcePath);
                console.log(tl.loc("DefaultRuntimeStackMessage", runtimeStack));
            }

            // Get the target port if provided, or determine it based on the application type
            var targetPort: string = tl.getInput("targetPort", false);
            if (!targetPort) {
                if (!!runtimeStack && runtimeStack.startsWith("python:")) {
                    targetPort = "80";
                } else {
                    targetPort = "8080";
                }

                console.log(tl.loc("DefaultTargetPortMessage", targetPort));
            }

            // If using the Oryx++ Builder to produce an image, create a runnable application image
            if (!dockerfilePath && shouldBuildAndPushImage) {
                console.log(tl.loc("CreateImageWithBuilderMessage"));

                // Set the Oryx++ Builder as the default builder locally
                new ContainerAppHelper().setDefaultBuilder();

                // Create a runnable application image
                new ContainerAppHelper().createRunnableAppImage(imageToDeploy, appSourcePath, runtimeStack);
            }

            // If a Dockerfile was found or provided, create a runnable application image from that
            if (!!dockerfilePath && shouldBuildAndPushImage) {
                console.log(tl.loc("CreateImageWithDockerfileMessage", dockerfilePath));
                new ContainerAppHelper().createRunnableAppImageFromDockerfile(imageToDeploy, appSourcePath, dockerfilePath);
            }

            // Push image to Azure Container Registry
            if (shouldBuildAndPushImage) {
                new ContainerRegistryHelper().pushImageToAcr(imageToDeploy);
            }

            // Create or update Azure Container App
            new ContainerAppHelper().createOrUpdateContainerApp(containerAppName, resourceGroup, imageToDeploy, targetPort, optionalCmdArgs);
        }
        catch (err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        }
        finally {
            // Logout of Azure if logged in during this task session
            authHelper.logoutAzure();
        }
    }
}

azurecontainerapps.runMain();
