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
     * Creates or updates an Azure Container App based from an image that was previously built.
     * @param containerAppName - the name of the Container App
     * @param resourceGroup - the resource group that the Container App is found in
     * @param imageToDeploy - the name of the runnable application image that the Container App will be based from
     * @param optionalCmdArgs - a set of optional command line arguments
     */
     public createOrUpdateContainerApp(
        containerAppName: string,
        resourceGroup: string,
        imageToDeploy: string,
        optionalCmdArgs: string[]) {
            tl.debug(`Attempting to create/update Container App with name "${containerAppName}" in resource group "${resourceGroup}" based from image "${imageToDeploy}"`);
            try {
                let command = `containerapp up --name ${containerAppName} --resource-group ${resourceGroup} --image ${imageToDeploy}`;
                optionalCmdArgs.forEach(function (val: string) {
                    command += ` ${val}`;
                });

                new Utility().throwIfError(
                    tl.execSync('az', command),
                    tl.loc('CreateOrUpdateContainerAppFailed')
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
                let telemetryArg = `--env "CALLER_ID=azure-pipelines-v0"`;
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