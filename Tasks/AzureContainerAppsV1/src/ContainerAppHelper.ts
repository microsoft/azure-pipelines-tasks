import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import * as os from 'os';
import { CommandHelper } from './CommandHelper';
import { Utility } from './Utility';

const ORYX_CLI_IMAGE: string = 'mcr.microsoft.com/oryx/cli:builder-debian-buster-20230208.1';
const ORYX_BUILDER_IMAGE: string = 'mcr.microsoft.com/oryx/builder:20230208.1';
const IS_WINDOWS_AGENT: boolean = os.platform() == 'win32';
const PACK_CMD: string = IS_WINDOWS_AGENT ? path.join(os.tmpdir(), 'pack') : 'pack';

export class ContainerAppHelper {
    readonly disableTelemetry: boolean = false;

    constructor(disableTelemetry: boolean) {
        this.disableTelemetry = disableTelemetry;
    }

    /**
     * Creates an Azure Container App based from an image that was previously built.
     * @param containerAppName - the name of the Container App
     * @param resourceGroup - the resource group that the Container App is found in
     * @param environment - the Container App Environment that will be associated with the Container App
     * @param imageToDeploy - the name of the runnable application image that the Container App will be based from
     * @param optionalCmdArgs - a set of optional command line arguments
     */
     public createContainerApp(
        containerAppName: string,
        resourceGroup: string,
        environment: string,
        imageToDeploy: string,
        optionalCmdArgs: string[]) {
            tl.debug(`Attempting to create Container App with name "${containerAppName}" in resource group "${resourceGroup}" based from image "${imageToDeploy}"`);
            try {
                let command = `containerapp create -n ${containerAppName} -g ${resourceGroup} -i ${imageToDeploy} --environment ${environment}`;
                optionalCmdArgs.forEach(function (val: string) {
                    command += ` ${val}`;
                });

                new Utility().throwIfError(
                    tl.execSync('az', command),
                    tl.loc('CreateContainerAppFailed')
                );
            } catch (err) {
                tl.error(err.message);
                throw err;
            }
    }

    /**
     * Creates an Azure Container App based from a YAML configuration file.
     * @param containerAppName - the name of the Container App
     * @param resourceGroup - the resource group that the Container App is found in
     * @param yamlConfigPath - the path to the YAML configuration file that the Container App properties will be based from
     */
    public createContainerAppFromYaml(
        containerAppName: string,
        resourceGroup: string,
        yamlConfigPath: string) {
            tl.debug(`Attempting to create Container App with name "${containerAppName}" in resource group "${resourceGroup}" from provided YAML "${yamlConfigPath}"`);
            try {
                let command = `containerapp create -n ${containerAppName} -g ${resourceGroup} --yaml ${yamlConfigPath}`;

                new Utility().throwIfError(
                    tl.execSync('az', command),
                    tl.loc('CreateContainerAppFromYamlFailed')
                );
            } catch (err) {
                tl.error(err.message);
                throw err;
            }
    }

    /**
     * Updates an existing Azure Container App based from an image that was previously built.
     * @param containerAppName - the name of the existing Container App
     * @param resourceGroup - the resource group that the existing Container App is found in
     * @param imageToDeploy - the name of the runnable application image that the Container App will be based from
     * @param optionalCmdArgs - a set of optional command line arguments
     */
    public updateContainerApp(
        containerAppName: string,
        resourceGroup: string,
        imageToDeploy: string,
        optionalCmdArgs: string[]) {
            tl.debug(`Attempting to update Container App with name "${containerAppName}" in resource group "${resourceGroup}" based from image "${imageToDeploy}"`);
            try {
                let command = `containerapp update -n ${containerAppName} -g ${resourceGroup} -i ${imageToDeploy}`;
                optionalCmdArgs.forEach(function (val: string) {
                    command += ` ${val}`;
                });

                new Utility().throwIfError(
                    tl.execSync('az', command),
                    tl.loc('UpdateContainerAppFailed')
                );
            } catch (err) {
                tl.error(err.message);
                throw err;
            }
    }

    /**
     * Updates an existing Azure Container App using the 'az containerapp up' command.
     * @param containerAppName - the name of the existing Container App
     * @param resourceGroup - the resource group that the existing Container App is found in
     * @param imageToDeploy - the name of the runnable application image that the Container App will be based from
     * @param optionalCmdArgs - a set of optional command line arguments
     * @param ingress - the ingress that the Container App will be exposed on
     * @param targetPort - the target port that the Container App will be exposed on
     */
    public updateContainerAppWithUp(
        containerAppName: string,
        resourceGroup: string,
        imageToDeploy: string,
        optionalCmdArgs: string[],
        ingress?: string,
        targetPort?: string) {
            tl.debug(`Attempting to update Container App with name "${containerAppName}" in resource group "${resourceGroup}" based from image "${imageToDeploy}"`);
            const util = new Utility();
            try {
                let command = `containerapp up -n ${containerAppName} -g ${resourceGroup} -i ${imageToDeploy}`;
                optionalCmdArgs.forEach(function (val: string) {
                    command += ` ${val}`;
                });

                if (!util.isNullOrEmpty(ingress)) {
                    command += ` --ingress ${ingress}`;
                }

                if (!util.isNullOrEmpty(targetPort)) {
                    command += ` --target-port ${targetPort}`;
                }

                util.throwIfError(
                    tl.execSync('az', command),
                    tl.loc('UpdateContainerAppFailed')
                );
            } catch (err) {
                tl.error(err.message);
                throw err;
            }
        }

    /**
     * Updates an existing Azure Container App based from a YAML configuration file.
     * @param containerAppName - the name of the existing Container App
     * @param resourceGroup - the resource group that the existing Container App is found in
     * @param yamlConfigPath - the path to the YAML configuration file that the Container App properties will be based from
     */
    public updateContainerAppFromYaml(
        containerAppName: string,
        resourceGroup: string,
        yamlConfigPath: string) {
            tl.debug(`Attempting to update Container App with name "${containerAppName}" in resource group "${resourceGroup}" from provided YAML "${yamlConfigPath}"`);
            try {
                let command = `containerapp update -n ${containerAppName} -g ${resourceGroup} --yaml ${yamlConfigPath}`;

                new Utility().throwIfError(
                    tl.execSync('az', command),
                    tl.loc('UpdateContainerAppFromYamlFailed')
                );
            } catch (err) {
                tl.error(err.message);
                throw err;
            }
    }

    /**
     * Determines if the provided Container App exists in the provided resource group.
     * @param containerAppName - the name of the Container App
     * @param resourceGroup - the resource group that the Container App is found in
     * @returns true if the Container App exists, false otherwise
     */
    public doesContainerAppExist(containerAppName: string, resourceGroup: string): boolean {
        tl.debug(`Attempting to determine if Container App with name "${containerAppName}" exists in resource group "${resourceGroup}"`);
        try {
            const command = `containerapp show -n ${containerAppName} -g ${resourceGroup} -o none`;
            const result = tl.execSync('az', command);
            return result.code == 0;
        } catch (err) {
            tl.warning(err.message);
            return false;
        }
    }

    /**
     * Determines if the provided Container App Environment exists in the provided resource group.
     * @param containerAppEnvironment - the name of the Container App Environment
     * @param resourceGroup - the resource group that the Container App Environment is found in
     * @returns true if the Container App Environment exists, false otherwise
     */
    public doesContainerAppEnvironmentExist(containerAppEnvironment: string, resourceGroup: string): boolean {
        tl.debug(`Attempting to determine if Container App Environment with name "${containerAppEnvironment}" exists in resource group "${resourceGroup}"`);
        try {
            const command = `containerapp env show -n ${containerAppEnvironment} -g ${resourceGroup} -o none`;
            const result = tl.execSync('az', command);
            return result.code == 0;
        } catch (err) {
            tl.warning(err.message);
            return false;
        }
    }

    /**
     * Determines if the provided resource group exists.
     * @param resourceGroup - the name of the resource group
     * @returns true if the resource group exists, false otherwise
     */
    public doesResourceGroupExist(resourceGroup: string): boolean {
        tl.debug(`Attempting to determine if resource group "${resourceGroup}" exists`);
        try {
            const command = `group show -n ${resourceGroup} -o none`;
            const result = tl.execSync('az', command);
            return result.code == 0;
        } catch (err) {
            tl.warning(err.message);
            return false;
        }
    }

    /**
     * Gets the default location for the Container App provider.
     * @returns the default location if found, otherwise 'eastus2'
     */
    public getDefaultContainerAppLocation(): string {
        tl.debug(`Attempting to get the default location for the Container App service for the subscription.`);
        try {
            const command = `provider show -n Microsoft.App --query "resourceTypes[?resourceType=='containerApps'].locations[] | [0]"`
            const result = tl.execSync('az', command);

            // If successful, strip out double quotes, spaces and parentheses from the first location returned
            return result.code == 0 ? result.stdout.toLowerCase().replace(/["() ]/g, "") : `eastus2`;
        } catch (err) {
            tl.warning(err.message);
            return `eastus2`;
        }
    }

    /**
     * Creates a new resource group in the provided location.
     * @param name - the name of the resource group to create
     * @param location - the location to create the resource group in
     */
    public createResourceGroup(name: string, location: string) {
        tl.debug(`Attempting to create resource group "${name}" in location "${location}"`);
        try {
            const command = `group create -n ${name} -l ${location}`;
            new Utility().throwIfError(
                tl.execSync('az', command),
                tl.loc('CreateResourceGroupFailed', name)
            );
        } catch (err) {
            tl.error(err.message);
            throw err;
        }
    }

    /**
     * Gets the name of an existing Container App Environment in the provided resource group.
     * @param resourceGroup - the resource group to check for an existing Container App Environment
     * @returns the name of the existing Container App Environment, null if none exists
     */
    public getExistingContainerAppEnvironment(resourceGroup: string) {
        tl.debug(`Attempting to get the existing Container App Environment in resource group "${resourceGroup}"`);
        try {
            const command = `containerapp env list -g ${resourceGroup} --query [0].name"`;
            const result = tl.execSync('az', command);
            return result.code == 0 ? result.stdout : null;
        } catch (err) {
            tl.warning(err.message);
            return null;
        }
    }

    /**
     * Creates a new Azure Container App Environment in the provided resource group.
     * @param name - the name of the Container App Environment
     * @param resourceGroup - the resource group that the Container App Environment will be created in
     * @param location - the location that the Container App Environment will be created in
     */
    public createContainerAppEnvironment(name: string, resourceGroup: string, location?: string) {
        const util = new Utility();
        tl.debug(`Attempting to create Container App Environment with name "${name}" in resource group "${resourceGroup}"`);
        try {
            let command = `containerapp env create -n ${name} -g ${resourceGroup}`;
            if (!util.isNullOrEmpty(location)) {
                command += ` -l ${location}`;
            }

            util.throwIfError(
                tl.execSync('az', command),
                tl.loc('CreateContainerAppEnvironmentFailed')
            );
        } catch (err) {
            tl.error(err.message);
            throw err;
        }
    }

    /**
     * Disables ingress on an existing Container App.
     * @param name - the name of the Container App
     * @param resourceGroup - the resource group that the Container App is found in
     */
    public disableContainerAppIngress(name: string, resourceGroup: string) {
        tl.debug(`Attempting to disable ingress for Container App with name "${name}" in resource group "${resourceGroup}"`);
        try {
            const command = `containerapp ingress disable -n ${name} -g ${resourceGroup}`;
            new Utility().throwIfError(
                tl.execSync('az', command),
                tl.loc('DisableContainerAppIngressFailed')
            );
        } catch (err) {
            tl.error(err.message);
            throw err;
        }
    }

    /**
     * Updates the ACR details on an existing Container App.
     * @param name - the name of the Container App
     * @param resourceGroup - the resource group that the Container App is found in
     * @param acrName - the name of the Azure Container Registry (without the .azurecr.io suffix)
     * @param acrUsername - the username used to authenticate with the Azure Container Registry
     * @param acrPassword - the password used to authenticate with the Azure Container Registry
     */
    public updateContainerAppRegistryDetails(name: string, resourceGroup: string, acrName: string, acrUsername: string, acrPassword: string) {
        tl.debug(`Attempting to set the ACR details for Container App with name "${name}" in resource group "${resourceGroup}"`);
        try {
            const command = `containerapp registry set -n ${name} -g ${resourceGroup} --server ${acrName}.azurecr.io --username ${acrUsername} --password ${acrPassword}`;
            new Utility().throwIfError(
                tl.execSync('az', command),
                tl.loc('UpdateContainerAppRegistryDetailsFailed')
            );
        } catch (err) {
            tl.error(err.message);
            throw err;
        }
    }

    /**
     * Using the Oryx++ Builder, creates a runnable application image from the provided application source.
     * @param imageToDeploy - the name of the runnable application image that is created and can be later deployed
     * @param appSourcePath - the path to the application source on the machine
     * @param runtimeStack - the runtime stack to use in the image layer that runs the application
     */
    public createRunnableAppImage(
        imageToDeploy: string,
        appSourcePath: string,
        runtimeStack: string) {
            tl.debug(`Attempting to create a runnable application image using the Oryx++ Builder with image name "${imageToDeploy}"`);
            try {
                let telemetryArg = `--env "CALLER_ID=azure-pipelines-v1"`;
                if (this.disableTelemetry) {
                    telemetryArg = `--env "ORYX_DISABLE_TELEMETRY=true"`;
                }

                new Utility().throwIfError(
                    tl.execSync(PACK_CMD, `build ${imageToDeploy} --path ${appSourcePath} --builder ${ORYX_BUILDER_IMAGE} --run-image mcr.microsoft.com/oryx/${runtimeStack} ${telemetryArg}`),
                    tl.loc('CreateImageWithBuilderFailed')
                );
            } catch (err) {
                tl.error(err.message);
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
    public createRunnableAppImageFromDockerfile(
        imageToDeploy: string,
        appSourcePath: string,
        dockerfilePath: string) {
            tl.debug(`Attempting to create a runnable application image from the provided/found Dockerfile "${dockerfilePath}" with image name "${imageToDeploy}"`);
            try {
                new Utility().throwIfError(
                    tl.execSync('docker', `build --tag ${imageToDeploy} --file ${dockerfilePath} ${appSourcePath}`),
                    tl.loc('CreateImageWithDockerfileFailed')
                );
            } catch (err) {
                tl.error(err.message);
                throw err;
            }
    }

    /**
     * Determines the runtime stack to use for the runnable application image.
     * @param appSourcePath - the path to the application source on the machine
     * @returns a string representing the runtime stack that can be used for the Oryx MCR runtime images
     */
     public async determineRuntimeStackAsync(appSourcePath: string): Promise<string> {
        tl.debug('Attempting to determine the runtime stack needed for the provided application source');
        try {
            // Use 'oryx dockerfile' command to determine the runtime stack to use and write it to a temp file
            const dockerCommand: string = `run --rm -v ${appSourcePath}:/app ${ORYX_CLI_IMAGE} /bin/bash -c "oryx dockerfile /app | head -n 1 | sed 's/ARG RUNTIME=//' >> /app/oryx-runtime.txt"`;
            new Utility().throwIfError(
                tl.execSync('docker', dockerCommand),
                tl.loc('DetermineRuntimeStackFailed', appSourcePath)
            );

            // Read the temp file to get the runtime stack into a variable
            const oryxRuntimeTxtPath = path.join(appSourcePath, 'oryx-runtime.txt');
            let command: string = `head -n 1 ${oryxRuntimeTxtPath}`;
            if (IS_WINDOWS_AGENT) {
                command = `Get-Content -Path ${oryxRuntimeTxtPath} -Head 1`;
            }

            const runtimeStack = await new CommandHelper().execCommandAsync(command);

            // Delete the temp file
            command = `rm ${oryxRuntimeTxtPath}`;
            if (IS_WINDOWS_AGENT) {
                command = `Remove-Item -Path ${oryxRuntimeTxtPath}`;
            }

            await new CommandHelper().execCommandAsync(command);

            return runtimeStack;
        } catch (err) {
            tl.error(err.message);
            throw err;
        }
    }

    /**
     * Sets the default builder on the machine to the Oryx++ Builder to prevent an exception from being thrown due
     * to no default builder set.
     */
     public setDefaultBuilder() {
        tl.debug('Setting the Oryx++ Builder as the default builder via the pack CLI');
        try {
            new Utility().throwIfError(
                tl.execSync(PACK_CMD, `config default-builder ${ORYX_BUILDER_IMAGE}`),
                tl.loc('SetDefaultBuilderFailed')
            );
        } catch (err) {
            tl.error(err.message);
            throw err;
        }
    }

    /**
     * Installs the pack CLI that will be used to build a runnable application image.
     * For more information about the pack CLI can be found here: https://buildpacks.io/docs/tools/pack/
     */
     public async installPackCliAsync() {
        tl.debug('Attempting to install the pack CLI');
        try {
            let command: string = '';
            if (IS_WINDOWS_AGENT) {
                const packZipDownloadUri: string = 'https://github.com/buildpacks/pack/releases/download/v0.27.0/pack-v0.27.0-windows.zip';
                const packZipDownloadFilePath: string = path.join(PACK_CMD, 'pack-windows.zip');

                command = `New-Item -ItemType Directory -Path ${PACK_CMD} -Force | Out-Null;` +
                          `Invoke-WebRequest -Uri ${packZipDownloadUri} -OutFile ${packZipDownloadFilePath}; ` +
                          `Expand-Archive -LiteralPath ${packZipDownloadFilePath} -DestinationPath ${PACK_CMD}; ` +
                          `Remove-Item -Path ${packZipDownloadFilePath}`;
            } else {
                const tgzSuffix = os.platform() == 'darwin' ? 'macos' : 'linux';
                command = `(curl -sSL \"https://github.com/buildpacks/pack/releases/download/v0.27.0/pack-v0.27.0-${tgzSuffix}.tgz\" | ` +
                                  'tar -C /usr/local/bin/ --no-same-owner -xzv pack)';
            }

            await new CommandHelper().execCommandAsync(command);
        } catch (err) {
            tl.error(tl.loc('PackCliInstallFailed'));
            throw err;
        }
    }
}