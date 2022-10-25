import path = require("path");
import tl = require("azure-pipelines-task-lib/task");
import tr = require("azure-pipelines-task-lib/toolrunner");
import fs = require("fs");
import child = require("child_process")
import { IExecSyncResult } from 'azure-pipelines-task-lib/toolrunner';

const ORYX_CLI_IMAGE: string = "cormtestacr.azurecr.io/oryx/cli:latest";
const ORYX_BUILDER_IMAGE: string = "cormtestacr.azurecr.io/builder:latest";

export class azurecontainerapps {

    public static async runMain(): Promise<void> {
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

            // Install the pack CLI
            await this.installPackCliAsync();

            // Set the Azure CLI to dynamically install missing extensions
            this.throwIfError(
                tl.execSync("az", "config set extension.use_dynamic_install=yes_without_prompt"),
                "Unable to set the Azure CLI to dynamically install missing extensions");

            // Log in to Azure with the service connection provided
            var connectedService: string = tl.getInput("connectedServiceNameARM", true);
            this.loginAzureRM(connectedService);

            var acrName: string = tl.getInput("acrName", true);
            var acrUsername: string = tl.getInput("acrUsername", false);
            var acrPassword: string = tl.getInput("acrPassword", false);

            // Login to ACR if credentials were provided
            if (!!acrUsername && !!acrPassword) {
                console.log(tl.loc("AcrUsernamePasswordLoginMessage"));
                this.loginAcrWithUsernamePassword(acrName, acrUsername, acrPassword);
                optionalCmdArgs.push(
                    `--registry-server ${acrName}.azurecr.io`,
                    `--registry-username ${acrUsername}`,
                    `--registry-password ${acrPassword}`);
            }
            
            // Login to ACR with access token if no credentials were provided
            if (!acrUsername || !acrPassword) {
                console.log(tl.loc("AcrAccessTokenLoginMessage"));
                await this.loginAcrWithAccessTokenAsync(acrName);
            }

            // Get Dockerfile to build, if provided, or check if one exists at the root of the provided application
            var dockerfilePath: string = tl.getInput("dockerfilePath", false);
            if (!dockerfilePath) {
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
            var imageToDeploy: string = tl.getInput("imageToDeploy", false);
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
                runtimeStack = await this.determineRuntimeStackAsync(appSourcePath);
                console.log(tl.loc("DefaultRuntimeStackMessage", runtimeStack));
            }

            // Get the target port if provided, or determine it based on the application type
            var targetPort: string = tl.getInput("targetPort", false);
            if (!targetPort) {
                if (runtimeStack.startsWith("python:")) {
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
                this.setDefaultBuilder();

                // Create a runnable application image
                this.createRunnableAppImage(imageToDeploy, appSourcePath, runtimeStack);
            }

            // If a Dockerfile was found or provided, create a runnable application image from that
            if (!!dockerfilePath && shouldBuildAndPushImage) {
                console.log(tl.loc("CreateImageWithDockerfileMessage", dockerfilePath));
                this.createRunnableAppImageFromDockerfile(imageToDeploy, appSourcePath, dockerfilePath);
            }

            // Push image to Azure Container Registry
            if (shouldBuildAndPushImage) {
                this.pushImageToAcr(imageToDeploy);
            }

            // Create or update Azure Container App
            this.createOrUpdateContainerApp(containerAppName, resourceGroup, imageToDeploy, targetPort, optionalCmdArgs);
        }
        catch (err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
        }
        finally {
            if (this.cliPasswordPath) {
                tl.debug('Removing spn certificate file');
                tl.rmRF(this.cliPasswordPath);
            }

            // Logout of Azure if logged in during this task session
            if (this.sessionLoggedIn) {
                this.logoutAzure();
            }
        }
    }

    private static sessionLoggedIn: boolean = false;
    private static cliPasswordPath: string = null;

    /**
     * Re-uses the loginAzureRM code implemented by the AzureCLIV2 Azure DevOps Task.
     * https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/AzureCLIV2/azureclitask.ts#L106-L150
     * @param connectedService - an Azure DevOps Service Connection that can authorize the connection to Azure
     */
    private static loginAzureRM(connectedService: string): void {
        var authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, true);
        var subscriptionID: string = tl.getEndpointDataParameter(connectedService, "SubscriptionID", true);

        if(authScheme.toLowerCase() == "serviceprincipal") {
            let authType: string = tl.getEndpointAuthorizationParameter(connectedService, 'authenticationType', true);
            let cliPassword: string = null;
            var servicePrincipalId: string = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
            var tenantId: string = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);

            if (authType == "spnCertificate") {
                tl.debug('certificate based endpoint');
                let certificateContent: string = tl.getEndpointAuthorizationParameter(connectedService, "servicePrincipalCertificate", false);
                cliPassword = path.join(tl.getVariable('Agent.TempDirectory') || tl.getVariable('system.DefaultWorkingDirectory'), 'spnCert.pem');
                fs.writeFileSync(cliPassword, certificateContent);
                this.cliPasswordPath = cliPassword;
            }
            else {
                tl.debug('key based endpoint');
                cliPassword = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
            }

            let escapedCliPassword = cliPassword.replace(/"/g, '\\"');
            tl.setSecret(escapedCliPassword.replace(/\\/g, '\"'));
            //login using svn
            this.throwIfError(
                tl.execSync("az", `login --service-principal -u "${servicePrincipalId}" --password="${escapedCliPassword}" --tenant "${tenantId}" --allow-no-subscriptions`),
                "Azure login failed");
        }
        else if(authScheme.toLowerCase() == "managedserviceidentity") {
            //login using msi
            this.throwIfError(
                tl.execSync("az", "login --identity"),
                "Azure login failed using Managed Service Identity");
        }
        else{
            throw `Auth Scheme "${authScheme}" is not supported`;
        }

        this.sessionLoggedIn = true;
        if(!!subscriptionID) {
            //set the subscription imported to the current subscription
            this.throwIfError(
                tl.execSync("az", "account set --subscription \"" + subscriptionID + "\""),
                "Error in setting up subscription");
        }
    }

    /**
     * Re-uses the logoutAzure code implemented by the AzureCLIV2 Azure DevOps Task.
     * https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/AzureCLIV2/azureclitask.ts#L175-L183
     */
    private static logoutAzure() {
        tl.debug("Attempting to log out from Azure");
        try {
            tl.execSync("az", " account clear");
        }
        catch (err) {
            // task should not fail if logout doesn`t occur
            tl.warning(`The following error occurred while logging out: ${err.message}`);
        }
    }

    /**
     * Authorizes Docker to make calls to the provided ACR instance using username and password.
     * @param acrName - the name of the ACR instance to authenticate calls to
     * @param acrUsername - the username for authentication
     * @param acrPassword - the password for authentication
     */
    private static loginAcrWithUsernamePassword(acrName: string, acrUsername: string, acrPassword: string) {
        tl.debug(`Attempting to log in to ACR instance "${acrName}" with username and password credentials`);
        try {
            child.execSync(
                `docker login --password-stdin --username ${acrUsername} ${acrName}.azurecr.io`,
                { input: acrPassword });
        }
        catch (err) {
            tl.error(tl.loc("AcrUsernamePasswordAuthFailed", acrName));
            throw err;
        }
    }

    /**
     * Authorizes Docker to make calls to the provided ACR instance using an access token that is generated via
     * the 'az acr login --expose-token' command.
     * @param acrName - the name of the ACR instance to authenticate calls to.
     */
    private static async loginAcrWithAccessTokenAsync(acrName: string) {
        tl.debug(`Attempting to log in to ACR instance "${acrName}" with access token`);
        try {
            var command: string = `CA_ADO_TASK_ACR_ACCESS_TOKEN=$(az acr login --name ${acrName} --output json --expose-token --only-show-errors | jq -r '.accessToken'); docker login ${acrName}.azurecr.io -u 00000000-0000-0000-0000-000000000000 -p $CA_ADO_TASK_ACR_ACCESS_TOKEN > /dev/null 2>&1`;
            await this.execBashCommandAsync(command);
        }
        catch (err) {
            tl.error(tl.loc("AcrAccessTokenAuthFailed", acrName));
            throw err;
        }
    }

    /**
     * Installs the pack CLI that will be used to build a runnable application image.
     * For more information about the pack CLI can be found here: https://buildpacks.io/docs/tools/pack/
     */
    private static async installPackCliAsync() {
        tl.debug("Attempting to install the pack CLI");
        try {
            var command: string = "(curl -sSL \"https://github.com/buildpacks/pack/releases/download/v0.27.0/pack-v0.27.0-linux.tgz\" | " +
                                  "tar -C /usr/local/bin/ --no-same-owner -xzv pack)";
            await this.execBashCommandAsync(command);
        }
        catch (err) {
            tl.error(tl.loc("PackCliInstallFailed"));
            throw err;
        }
    }

    /**
     * Sets the default builder on the machine to the Oryx++ Builder to prevent an exception from being thrown due
     * to no default builder set.
     */
    private static setDefaultBuilder() {
        tl.debug("Setting the Oryx++ Builder as the default builder via the pack CLI");
        try {
            tl.execSync("pack", `config default-builder ${ORYX_BUILDER_IMAGE}`);
        }
        catch (err) {
            tl.error(tl.loc("SetDefaultBuilderFailed"));
            throw err;
        }
    }

    /**
     * Using the Oryx++ Builder, creates a runnable application image from the provided application source.
     * @param imageToDeploy - the name of the runnable application image that is created and can be later deployed
     * @param appSourcePath - the path to the application source on the machine
     * @param runtimeStack - the runtime stack to use in the image layer that runs the application
     */
    private static createRunnableAppImage(
        imageToDeploy: string,
        appSourcePath: string,
        runtimeStack: string) {
            tl.debug(`Attempting to create a runnable application image using the Oryx++ Builder with image name "${imageToDeploy}"`);
            try {
                tl.execSync("pack", `build ${imageToDeploy} --path ${appSourcePath} --builder ${ORYX_BUILDER_IMAGE} --run-image mcr.microsoft.com/oryx/${runtimeStack}`);
            }
            catch (err) {
                tl.error(tl.loc("CreateImageWithBuilderFailed"));
                throw err;
            }
    }

    /**
     * Using a Dockerfile that was provided or found at the root of the application source,
     * creates a runable application image.
     * @param imageToDeploy - the name of the runnable application image that is created and can be later deployed
     * @param appSourcePath - the path to the application source on the machine
     * @param dockerfilePath - the path to the Dockerfile to build and tag with the provided image name
     */
    private static createRunnableAppImageFromDockerfile(
        imageToDeploy: string,
        appSourcePath: string,
        dockerfilePath: string) {
            tl.debug(`Attempting to create a runnable application image from the provided/found Dockerfile "${dockerfilePath}" with image name "${imageToDeploy}"`);
            try {
                tl.execSync("docker", `build --tag ${imageToDeploy} --file ${dockerfilePath} ${appSourcePath}`);
            }
            catch (err) {
                tl.error(tl.loc("CreateImageWithDockerfileFailed"));
                throw err;
            }
    }

    /**
     * Pushes an image to the ACR instance that was previously authenticated against.
     * @param imageToPush - the name of the image to push to ACR
     */
    private static pushImageToAcr(imageToPush: string) {
        tl.debug(`Attempting to push image "${imageToPush}" to ACR`);
        try {
            tl.execSync("docker", `push ${imageToPush}`);
        }
        catch (err) {
            tl.error(tl.loc("PushImageToAcrFailed", imageToPush));
            throw err;
        }
    }

    /**
     * Creates or updates an Azure Container App based from an image that was previously built.
     * @param containerAppName - the name of the Container App
     * @param resourceGroup - the resource group that the Container App is found in
     * @param imageToDeploy - the name of the runnable application image that the Container App will be based from
     * @param targetPort - the target port that the Container App will listen on
     * @param optionalCmdArgs - a set of optional command line arguments
     */
    private static createOrUpdateContainerApp(
        containerAppName: string,
        resourceGroup: string,
        imageToDeploy: string,
        targetPort: string,
        optionalCmdArgs: string[]) {
            tl.debug(`Attempting to create/update Container App with name "${containerAppName}" in resource group "${resourceGroup}" based from image "${imageToDeploy}"`)
            try {
                var command = `containerapp up --name ${containerAppName} --resource-group ${resourceGroup} --image ${imageToDeploy} --target-port ${targetPort}`;
                optionalCmdArgs.forEach(function (val) {
                    command += ` ${val}`;
                });

                tl.execSync('az', command);
            }
            catch (err) {
                tl.error(tl.loc("CreateOrUpdateContainerAppFailed"));
                throw err;
            }
    }

    /**
     * Determines the runtime stack to use for the runnable application image.
     * @param appSourcePath - the path to the application source on the machine
     * @returns a string representing the runtime stack that can be used for the Oryx MCR runtime images
     */
    private static async determineRuntimeStackAsync(appSourcePath: string): Promise<string> {
        tl.debug("Attempting to determine the runtime stack needed for the provided application source");
        try {
            // Use 'oryx dockerfile' command to determine the runtime stack to use and write it to a temp file
            var dockerCommand: string = `run --rm -v ${appSourcePath}:/app ${ORYX_CLI_IMAGE} /bin/bash -c "oryx dockerfile /app | head -n 1 | sed 's/ARG RUNTIME=//' >> /app/oryx-runtime.txt"`;
            tl.execSync("docker", dockerCommand);

            // Read the temp file to get the runtime stack into a variable
            var command: string = `head -n 1 ${appSourcePath}/oryx-runtime.txt`;
            var runtimeStack = await this.execBashCommandAsync(command);

            // Delete the temp file
            command = `rm ${appSourcePath}/oryx-runtime.txt`;
            await this.execBashCommandAsync(command);

            return runtimeStack;
        }
        catch (err) {
            tl.error(tl.loc("DetermineRuntimeStackFailed", appSourcePath));
            throw err;
        }
    }
    
    /**
     * Re-uses logic from the translateDirectoryPath code implemented by the BashV3 Azure DevOps Task.
     * https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/BashV3/bash.ts#L7-L30
     * @param command - the command to execute in Bash
     * @param cwd - the current working directory; if not provided, the 'cwd' input will be used
     * @returns the string output from the command
     */
    private static async execBashCommandAsync(command: string, cwd?: string): Promise<string> {
        try {
            if (!cwd) {
                cwd = tl.getPathInput("cwd", true, false);
            }

            let bashPath: string = tl.which('bash', true);
            let bashCmd = tl.tool(bashPath)
                            .arg("-c")
                            .arg(command);
            let bashOptions = <tr.IExecOptions> {
                cwd: cwd,
                failOnStdErr: true,
                errStream: process.stderr,
                outStream: process.stdout,
                ignoreReturnCode: false
            };
            let bashOutput = '';
            bashCmd.on("stdout", (data) => {
                bashOutput += data.toString();
            });
            await bashCmd.exec(bashOptions);
            return bashOutput.trim();
        } catch (err) {
            tl.error(tl.loc("BashCommandFailed", command));
            throw err;
        }
    }

    // Using throwIfError function from AzureCLI task for convenience:
    // https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/AzureCLIV2/src/Utility.ts

    /**
     * Re-uses the throwIfError code implemented by the AzureCLIV2 Azure DevOps Task.
     * https://github.com/microsoft/azure-pipelines-tasks/blob/b82a8e69eb862d1a9d291af70da2e62ee69270df/Tasks/AzureCLIV2/src/Utility.ts#L79-L87
     * @param resultOfToolExecution - the result of the command that was previously executed
     * @param errormsg - the error message to display if the command failed
     */
    private static throwIfError(resultOfToolExecution: IExecSyncResult, errormsg?: string): void {
        if (resultOfToolExecution.code != 0) {
            tl.error(tl.loc("ErrorCodeFormat", resultOfToolExecution.code));
            if (errormsg) {
                tl.error(tl.loc("ErrorMessageFormat", errormsg));
            }
            throw resultOfToolExecution;
        }
    }

}

azurecontainerapps.runMain();
