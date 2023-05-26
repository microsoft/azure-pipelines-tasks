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
        this.initializeHelpers(disableTelemetry);

        try {
            // Set up localization
            tl.setResourcePath(path.join(__dirname, 'task.json'));

            const cwd: string = tl.getPathInput('cwd', true, false);
            tl.mkdirP(cwd);
            tl.cd(cwd);

            // Validate that the arguments provided can be used for one of the supported scenarios
            this.validateSupportedScenarioArguments();

            // Set up the Azure CLI to be used for this task
            await this.setupAzureCli();

            // Set up the resources required to deploy a Container App
            this.setupResources();

            // If an Azure Container Registry name was provided, try to authenticate against it
            if (!util.isNullOrEmpty(this.acrName)) {
                await this.authenticateAzureContainerRegistryAsync();
            }

            // If the application source was provided, build a runnable application image from it
            if (!util.isNullOrEmpty(this.appSourcePath)) {
                await this.buildAndPushImageAsync();
            }

            // If no application source was provided, set up the scenario for deploying an existing image
            if (util.isNullOrEmpty(this.appSourcePath)) {
                this.setupExistingImageScenario();
            }

            // If no YAML configuration file was provided, set up the Container App properties
            if (util.isNullOrEmpty(this.yamlConfigPath)) {
                this.setupContainerAppProperties();
            }

            // Create/update the Container App
            this.createOrUpdateContainerApp();

            // If telemetry is enabled, log that the task completed successfully
            this.telemetryHelper.setSuccessfulResult();
        } catch (err) {
            tl.setResult(tl.TaskResult.Failed, err.message);
            this.telemetryHelper.setFailedResult(err.message);
        } finally {
            // Logout of Azure if logged in during this task session
            this.authHelper.logoutAzure();
            
            // If telemetry is enabled, will log metadata for this task run
            this.telemetryHelper.sendLogs();
        }
    }


    // Azure DevOps build properties
    private static buildId: string = tl.getVariable('Build.BuildId');
    private static buildNumber = tl.getVariable('Build.BuildNumber');

    // Supported scenario properties
    private static appSourcePath: string;
    private static acrName: string;
    private static imageToDeploy: string;
    private static yamlConfigPath: string;

    // Resource properties
    private static containerAppName: string;
    private static containerAppExists: boolean;
    private static location: string;
    private static resourceGroup: string;
    private static containerAppEnvironment: string;
    private static ingressEnabled: boolean;

    // ACR properties
    private static acrUsername: string;
    private static acrPassword: string;

    // Command line arguments
    private static commandLineArgs: string[];

    // Helper properties
    private static telemetryHelper: TelemetryHelper;
    private static authHelper: AzureAuthenticationHelper;
    private static appHelper: ContainerAppHelper;
    private static registryHelper: ContainerRegistryHelper;

    // Miscellaneous properties
    private static imageToBuild: string;
    private static runtimeStack: string;
    private static ingress: string;
    private static targetPort: string;
    private static shouldUseUpdateCommand: boolean;

    /**
     * Initializes the helpers used by this task.
     * @param disableTelemetry - Whether or not to disable telemetry for this task.
     */
    private static initializeHelpers(disableTelemetry: boolean) {
        // Set up TelemetryHelper for managing telemetry calls
        this.telemetryHelper = new TelemetryHelper(disableTelemetry);

        // Set up AzureAuthenticationHelper for managing logging in and out of Azure CLI using provided service connection
        this.authHelper = new AzureAuthenticationHelper();

        // Set up ContainerAppHelper for managing calls around the Container App
        this.appHelper = new ContainerAppHelper(disableTelemetry);

        // Set up ContainerRegistryHelper for managing calls around ACR
        this.registryHelper = new ContainerRegistryHelper();
    }

    /**
     * Validates the arguments provided to the task for supported scenarios.
     * @throws Error if a valid combination of the support scenario arguments is not provided.
     */
    private static validateSupportedScenarioArguments() {

        // Get the path to the application source to build and run, if provided
        this.appSourcePath = tl.getInput('appSourcePath', false);

        // Get the name of the ACR instance to push images to, if provided
        this.acrName = tl.getInput('acrName', false);

        // Get the previously built image to deploy, if provided
        this.imageToDeploy = tl.getInput('imageToDeploy', false);

        // Get the YAML configuration file, if provided
        this.yamlConfigPath = tl.getInput('yamlConfigPath', false);

        // Ensure that acrName is also provided if appSourcePath is provided
        if (!util.isNullOrEmpty(this.appSourcePath) && util.isNullOrEmpty(this.acrName)) {
            tl.error(tl.loc('MissingAcrNameMessage'));
            throw Error(tl.loc('MissingAcrNameMessage'));
        }

        // Ensure that one of appSourcePath, imageToDeploy, or yamlConfigPath is provided
        if (util.isNullOrEmpty(this.appSourcePath) && util.isNullOrEmpty(this.imageToDeploy) && util.isNullOrEmpty(this.yamlConfigPath)) {
            tl.error(tl.loc('MissingRequiredArgumentMessage'));
            throw Error(tl.loc('MissingRequiredArgumentMessage'));
        }
    }

    /**
     * Sets up the Azure CLI to be used for this task by logging in to Azure with the provided service connection and
     * setting the Azure CLI to dynamically install missing extensions.
     */
    private static async setupAzureCli() {
        // Log in to Azure with the service connection provided
        const connectedService: string = tl.getInput('connectedServiceNameARM', true);
        await this.authHelper.loginAzureRM(connectedService);

        // Set the Azure CLI to dynamically install missing extensions
        util.setAzureCliDynamicInstall();
    }

    /**
     * Sets up the resources required to deploy a Container App. This includes the following:
     * - Getting or generating the Container App name
     * - Getting or discovering the location to deploy resources to
     * - Getting or creating the resource group
     * - Getting or creating the Container App Environment
     */
    private static setupResources() {
        // Get the Container App name if it was provided, or generate it from build variables
        this.containerAppName = this.getContainerAppName();

        // Get the location to deploy resources to, if provided, or use the default location
        this.location = this.getLocation();

        // Get the resource group to deploy to if it was provided, or generate it from the Container App name
        this.resourceGroup = this.getOrCreateResourceGroup(this.containerAppName, this.location);

        // Determine if the Container App currently exists
        this.containerAppExists = this.appHelper.doesContainerAppExist(this.containerAppName, this.resourceGroup);

        // If the Container App doesn't exist, get/create the Container App Environment to use for the Container App
        if (!this.containerAppExists) {
            this.containerAppEnvironment = this.getOrCreateContainerAppEnvironment(this.containerAppName, this.resourceGroup, this.location);
        }
    }

    /**
     * Gets the name of the Container App to use for the task. If the 'containerAppName' argument is not provided,
     * then a default name will be generated in the form 'ado-task-app-<buildId>-<buildNumber>'.
     * @returns The name of the Container App to use for the task.
     */
    private static getContainerAppName(): string {
        let containerAppName: string = tl.getInput('containerAppName', false);
        if (util.isNullOrEmpty(containerAppName)) {
            containerAppName = `ado-task-app-${this.buildId}-${this.buildNumber}`;

            // Replace all '.' characters with '-' characters in the Container App name
            containerAppName = containerAppName.replace(/\./gi, "-");
            console.log(tl.loc('DefaultContainerAppNameMessage', containerAppName));
        }

        return containerAppName;
    }

    /**
     * Gets the location to deploy resources to. If the 'location' argument is not provided, then the default location
     * for the Container App service will be used.
     * @returns The location to deploy resources to.
     */
    private static getLocation(): string {
        // Set deployment location, if provided
        let location: string = tl.getInput('location', false);

        // If no location was provided, use the default location for the Container App service
        if (util.isNullOrEmpty(location)) {
            location = this.appHelper.getDefaultContainerAppLocation();
        }

        return location;
    }

    /**
     * Gets the name of the resource group to use for the task. If the 'resourceGroup' argument is not provided,
     * then a default name will be generated in the form '<containerAppName>-rg'. If the generated resource group does
     * not exist, it will be created.
     * @param containerAppName - The name of the Container App to use for the task.
     * @param location - The location to deploy resources to.
     * @returns The name of the resource group to use for the task.
     */
    private static getOrCreateResourceGroup(containerAppName: string, location: string): string {
        // Get the resource group to deploy to if it was provided, or generate it from the Container App name
        let resourceGroup: string = tl.getInput('resourceGroup', false);
        if (util.isNullOrEmpty(resourceGroup)) {
            resourceGroup = `${containerAppName}-rg`;
            console.log(tl.loc('DefaultResourceGroupMessage', resourceGroup));

            // Ensure that the resource group that the Container App will be created in exists
            const resourceGroupExists = this.appHelper.doesResourceGroupExist(resourceGroup);
            if (!resourceGroupExists) {
                this.appHelper.createResourceGroup(resourceGroup, location);
            }
        }

        return resourceGroup;
    }

    /**
     * Gets the name of the Container App Environment to use for the task. If the 'containerAppEnvironment' argument
     * is not provided, then the task will attempt to discover an existing Container App Environment in the resource
     * group. If no existing Container App Environment is found, then a default name will be generated in the form
     * '<containerAppName>-env'. If the Container App Environment does not exist, it will be created.
     * @param containerAppName - The name of the Container App to use for the task.
     * @param resourceGroup - The name of the resource group to use for the task.
     * @param location - The location to deploy resources to.
     * @returns The name of the Container App Environment to use for the task.
     */
    private static getOrCreateContainerAppEnvironment(
        containerAppName: string,
        resourceGroup: string,
        location: string): string {
        // Get the Container App environment if it was provided
        let containerAppEnvironment: string = tl.getInput('containerAppEnvironment', false);

        // See if we can reuse an existing Container App environment found in the resource group
        if (util.isNullOrEmpty(containerAppEnvironment)) {
            const existingContainerAppEnvironment: string = this.appHelper.getExistingContainerAppEnvironment(resourceGroup);
            if (!util.isNullOrEmpty(existingContainerAppEnvironment)) {
                console.log(tl.loc('ExistingContainerAppEnvironmentMessage', containerAppEnvironment));
                return existingContainerAppEnvironment
            }
        }

        // Generate the Container App environment name if it was not provided
        if (util.isNullOrEmpty(containerAppEnvironment)) {
            containerAppEnvironment = `${containerAppName}-env`;
            console.log(tl.loc('DefaultContainerAppEnvironmentMessage', containerAppEnvironment));
        }

        // Determine if the Container App environment currently exists and create one if it doesn't
        const containerAppEnvironmentExists: boolean = this.appHelper.doesContainerAppEnvironmentExist(containerAppEnvironment, resourceGroup);
        if (!containerAppEnvironmentExists) {
            this.appHelper.createContainerAppEnvironment(containerAppEnvironment, resourceGroup, location);
        }

        return containerAppEnvironment;
    }

    /**
     * Authenticates calls to the provided Azure Container Registry.
     */
    private static async authenticateAzureContainerRegistryAsync() {
        this.acrUsername = tl.getInput('acrUsername', false);
        this.acrPassword = tl.getInput('acrPassword', false);

        // Login to ACR if credentials were provided
        if (!util.isNullOrEmpty(this.acrUsername) && !util.isNullOrEmpty(this.acrPassword)) {
            console.log(tl.loc('AcrUsernamePasswordLoginMessage'));
            this.registryHelper.loginAcrWithUsernamePassword(this.acrName, this.acrUsername, this.acrPassword);
        } else {
            console.log(tl.loc('AcrAccessTokenLoginMessage'));
            await this.registryHelper.loginAcrWithAccessTokenAsync(this.acrName);
        }
    }

    /**
     * Sets up the scenario where an existing image is used for the Container App.
     */
    private static setupExistingImageScenario() {
        // If telemetry is enabled, log that the previously built image scenario was targeted for this task
        this.telemetryHelper.setImageScenario();
    }

    /**
     * Builds a runnable application image using a Dockerfile or the builder and pushes it to ACR.
     */
    private static async buildAndPushImageAsync() {
        // Get the name of the image to build if it was provided, or generate it from build variables
        this.imageToBuild = tl.getInput('imageToBuild', false);
        if (util.isNullOrEmpty(this.imageToBuild)) {
            this.imageToBuild = `${this.acrName}.azurecr.io/ado-task/container-app:${this.buildId}.${this.buildNumber}`;
            console.log(tl.loc('DefaultImageToBuildMessage', this.imageToBuild));
        }

        // Get the name of the image to deploy if it was provided, or set it to the value of 'imageToBuild'
        if (util.isNullOrEmpty(this.imageToDeploy)) {
            this.imageToDeploy = this.imageToBuild;
            console.log(tl.loc('DefaultImageToDeployMessage', this.imageToDeploy));
        }

        // Get Dockerfile to build, if provided, or check if one exists at the root of the provided application
        let dockerfilePath: string = tl.getInput('dockerfilePath', false);
        if (util.isNullOrEmpty(dockerfilePath)) {
            console.log(tl.loc('CheckForAppSourceDockerfileMessage', this.appSourcePath));
            const rootDockerfilePath = path.join(this.appSourcePath, 'Dockerfile');
            if (fs.existsSync(rootDockerfilePath)) {
                console.log(tl.loc('FoundAppSourceDockerfileMessage', rootDockerfilePath));
                dockerfilePath = rootDockerfilePath;
            } else {
                // No Dockerfile found or provided, build the image using the builder
                await this.buildImageFromBuilderAsync(this.appSourcePath, this.imageToBuild);
            }
        } else {
            dockerfilePath = path.join(this.appSourcePath, dockerfilePath);
        }

        if (!util.isNullOrEmpty(dockerfilePath)) {
            // Build the image from the provided/discovered Dockerfile
            this.builderImageFromDockerfile(this.appSourcePath, dockerfilePath, this.imageToBuild);
        }

        // Push the image to ACR
        this.registryHelper.pushImageToAcr(this.imageToBuild);
    }

    /**
     * Builds a runnable application image using the builder.
     * @param appSourcePath - The path to the application source code.
     * @param imageToBuild - The name of the image to build.
     */
    private static async buildImageFromBuilderAsync(appSourcePath: string, imageToBuild: string) {
        // Install the pack CLI
        await this.appHelper.installPackCliAsync();

        // Get the runtime stack if provided, or determine it using Oryx
        this.runtimeStack = tl.getInput('runtimeStack', false);
        if (util.isNullOrEmpty(this.runtimeStack)) {
            this.runtimeStack = await this.appHelper.determineRuntimeStackAsync(appSourcePath);
            console.log(tl.loc('DefaultRuntimeStackMessage', this.runtimeStack));
        }

        console.log(tl.loc('CreateImageWithBuilderMessage'));

        // Set the Oryx++ Builder as the default builder locally
        this.appHelper.setDefaultBuilder();

        // Create a runnable application image
        this.appHelper.createRunnableAppImage(imageToBuild, appSourcePath, this.runtimeStack);

        // If telemetry is enabled, log that the builder scenario was targeted for this task
        this.telemetryHelper.setBuilderScenario();
    }

    /**
     * Builds a runnable application image using a provided or discovered Dockerfile.
     * @param appSourcePath - The path to the application source code.
     * @param dockerfilePath - The path to the Dockerfile to build.
     * @param imageToBuild - The name of the image to build.
     */
    private static builderImageFromDockerfile(appSourcePath: string, dockerfilePath: string, imageToBuild: string) {
        console.log(tl.loc('CreateImageWithDockerfileMessage', dockerfilePath));
        this.appHelper.createRunnableAppImageFromDockerfile(imageToBuild, appSourcePath, dockerfilePath);

        // If telemetry is enabled, log that the Dockerfile scenario was targeted for this task
        this.telemetryHelper.setDockerfileScenario();
    }

    /**
     * Sets up the Container App properties that will be passed through to the Azure CLI when a YAML configuration
     * file is not provided.
     */
    private static setupContainerAppProperties() {
        this.commandLineArgs = [];

        // Get the ingress inputs
        this.ingress = tl.getInput('ingress', false);
        this.targetPort = tl.getInput('targetPort', false);

        // If both ingress and target port were not provided for an existing Container App, or if ingress is to be disabled,
        // use the 'update' command, otherwise we should use the 'up' command that performs a PATCH operation on the ingress properties.
        this.shouldUseUpdateCommand = this.containerAppExists &&
                                      util.isNullOrEmpty(this.targetPort) &&
                                      (util.isNullOrEmpty(this.ingress) || this.ingress == 'disabled');

        // Pass the ACR credentials when creating a Container App or updating a Container App via the 'up' command
        if (!util.isNullOrEmpty(this.acrName) && !util.isNullOrEmpty(this.acrUsername) && !util.isNullOrEmpty(this.acrPassword) &&
            (!this.containerAppExists || (this.containerAppExists && !this.shouldUseUpdateCommand))) {
            this.commandLineArgs.push(
                `--registry-server ${this.acrName}.azurecr.io`,
                `--registry-username ${this.acrUsername}`,
                `--registry-password ${this.acrPassword}`);
        }

        // Determine default values only for the 'create' scenario to avoid overriding existing values for the 'update' scenario
        if (!this.containerAppExists) {
            this.ingressEnabled = true;

            // Set the ingress value to 'external' if it was not provided
            if (util.isNullOrEmpty(this.ingress)) {
                this.ingress = 'external';
                console.log(tl.loc('DefaultIngressMessage', this.ingress));
            }

            // Set the value of ingressEnabled to 'false' if ingress was provided as 'disabled'
            if (this.ingress == 'disabled') {
                this.ingressEnabled = false;
                console.log(tl.loc('DisabledIngressMessage'));
            }

            // Handle setup for ingress values when enabled
            if (this.ingressEnabled) {
                // Get the target port if provided, or determine it based on the application type
                this.targetPort = tl.getInput('targetPort', false);
                if (util.isNullOrEmpty(this.targetPort)) {
                    if (!util.isNullOrEmpty(this.runtimeStack) && this.runtimeStack.startsWith('python:')) {
                        this.targetPort = '80';
                    } else {
                        this.targetPort = '8080';
                    }

                    console.log(tl.loc('DefaultTargetPortMessage', this.targetPort));
                }

                // Set the target port to 80 if it was not provided or determined
                if (util.isNullOrEmpty(this.targetPort)) {
                    this.targetPort = '80';
                    console.log(tl.loc('DefaultTargetPortMessage', this.targetPort));
                }

                // Add the ingress value and target port to the optional arguments array
                // Note: this step should be skipped if we're updating an existing Container App (ingress is enabled via a separate command)
                this.commandLineArgs.push(`--ingress ${this.ingress}`);
                this.commandLineArgs.push(`--target-port ${this.targetPort}`);
            }
        }

        const environmentVariables: string = tl.getInput('environmentVariables', false);

        // Add user-specified environment variables
        if (!util.isNullOrEmpty(environmentVariables)) {
            // The --replace-env-vars flag is only used for the 'update' command,
            // otherwise --env-vars is used for 'create' and 'up'
            if (this.shouldUseUpdateCommand) {
                this.commandLineArgs.push(`--replace-env-vars ${environmentVariables}`);
            } else {
                this.commandLineArgs.push(`--env-vars ${environmentVariables}`);
            }
        }
    }

    /**
     * Creates or updates the Container App.
     */
    private static createOrUpdateContainerApp() {
        if (!this.containerAppExists) {
            if (!util.isNullOrEmpty(this.yamlConfigPath)) {
                // Create the Container App from the YAML configuration file
                this.appHelper.createContainerAppFromYaml(this.containerAppName, this.resourceGroup, this.yamlConfigPath);
            } else {
                // Create the Container App from command line arguments
                this.appHelper.createContainerApp(this.containerAppName, this.resourceGroup, this.containerAppEnvironment, this.imageToDeploy, this.commandLineArgs);
            }

            return;
        }

        if (!util.isNullOrEmpty(this.yamlConfigPath)) {
            // Update the Container App from the YAML configuration file
            this.appHelper.updateContainerAppFromYaml(this.containerAppName, this.resourceGroup, this.yamlConfigPath);

            return;
        }

        if (this.shouldUseUpdateCommand) {
            // Update the ACR details on the existing Container App, if provided as an input
            if (!util.isNullOrEmpty(this.acrName) && !util.isNullOrEmpty(this.acrUsername) && !util.isNullOrEmpty(this.acrPassword)) {
                this.appHelper.updateContainerAppRegistryDetails(this.containerAppName, this.resourceGroup, this.acrName, this.acrUsername, this.acrPassword);
            }

            // Update the Container App using the 'update' command
            this.appHelper.updateContainerApp(this.containerAppName, this.resourceGroup, this.imageToDeploy, this.commandLineArgs);
        } else {
            // Update the Container App using the 'up' command
            this.appHelper.updateContainerAppWithUp(this.containerAppName, this.resourceGroup, this.imageToDeploy, this.commandLineArgs, this.ingress, this.targetPort);
        }

        // Disable ingress on the existing Container App, if provided as an input
        if (this.ingress == 'disabled') {
            this.appHelper.disableContainerAppIngress(this.containerAppName, this.resourceGroup);
        }
    }
}

azurecontainerapps.runMain();
