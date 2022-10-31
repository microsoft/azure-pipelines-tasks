import tl = require("azure-pipelines-task-lib/task");
import { CommandHelper } from "./CommandHelper";

const ORYX_CLI_IMAGE: string = "cormtestacr.azurecr.io/oryx/cli:latest";
const ORYX_BUILDER_IMAGE: string = "cormtestacr.azurecr.io/builder:latest";

export class ContainerAppHelper {
    /**
     * Creates or updates an Azure Container App based from an image that was previously built.
     * @param containerAppName - the name of the Container App
     * @param resourceGroup - the resource group that the Container App is found in
     * @param imageToDeploy - the name of the runnable application image that the Container App will be based from
     * @param targetPort - the target port that the Container App will listen on
     * @param optionalCmdArgs - a set of optional command line arguments
     */
     public createOrUpdateContainerApp(
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
    public createRunnableAppImageFromDockerfile(
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
     * Determines the runtime stack to use for the runnable application image.
     * @param appSourcePath - the path to the application source on the machine
     * @returns a string representing the runtime stack that can be used for the Oryx MCR runtime images
     */
     public async determineRuntimeStackAsync(appSourcePath: string): Promise<string> {
        tl.debug("Attempting to determine the runtime stack needed for the provided application source");
        try {
            // Use 'oryx dockerfile' command to determine the runtime stack to use and write it to a temp file
            var dockerCommand: string = `run --rm -v ${appSourcePath}:/app ${ORYX_CLI_IMAGE} /bin/bash -c "oryx dockerfile /app | head -n 1 | sed 's/ARG RUNTIME=//' >> /app/oryx-runtime.txt"`;
            tl.execSync("docker", dockerCommand);

            // Read the temp file to get the runtime stack into a variable
            var command: string = `head -n 1 ${appSourcePath}/oryx-runtime.txt`;
            var runtimeStack = await new CommandHelper().execBashCommandAsync(command);

            // Delete the temp file
            command = `rm ${appSourcePath}/oryx-runtime.txt`;
            await new CommandHelper().execBashCommandAsync(command);

            return runtimeStack;
        }
        catch (err) {
            tl.error(tl.loc("DetermineRuntimeStackFailed", appSourcePath));
            throw err;
        }
    }

    /**
     * Sets the default builder on the machine to the Oryx++ Builder to prevent an exception from being thrown due
     * to no default builder set.
     */
     public setDefaultBuilder() {
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
     * Installs the pack CLI that will be used to build a runnable application image.
     * For more information about the pack CLI can be found here: https://buildpacks.io/docs/tools/pack/
     */
     public async installPackCliAsync() {
        tl.debug("Attempting to install the pack CLI");
        try {
            var command: string = "(curl -sSL \"https://github.com/buildpacks/pack/releases/download/v0.27.0/pack-v0.27.0-linux.tgz\" | " +
                                  "tar -C /usr/local/bin/ --no-same-owner -xzv pack)";
            await new CommandHelper().execBashCommandAsync(command);
        }
        catch (err) {
            tl.error(tl.loc("PackCliInstallFailed"));
            throw err;
        }
    }
}