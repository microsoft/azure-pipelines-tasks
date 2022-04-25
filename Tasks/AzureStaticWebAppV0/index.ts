import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import trm = require('azure-pipelines-task-lib/toolrunner');
import fs = require('fs');

const appLocationInputName = 'app_location';
const appBuildCommandInputName = 'app_build_command';
const outputLocationInputName = 'output_location';
const apiLocationInputName = 'api_location';
const apiBuildCommandInputName = 'api_build_command';
const routesLocationInputName = 'routes_location';
const buildTimeoutInMinutesInputName = 'build_timeout_in_minutes';
const configFileLocationInputName = 'config_file_location';
const apiTokenInputName = 'azure_static_web_apps_api_token';
const deploymentEnvironmentInputName = 'deployment_environment';
const productionBranchInputName = 'production_branch';

async function run() {
    const envVarFilePath: string = path.join(__dirname, 'env.list');

    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        var bash: trm.ToolRunner = tl.tool(tl.which('bash', true));

        var scriptPath: string = path.join(__dirname, 'launch-docker.sh');

        var taskWorkingDirectory: string = path.dirname(scriptPath);

        tl.mkdirP(taskWorkingDirectory);
        tl.cd(taskWorkingDirectory);

        bash.arg(scriptPath);

        bash.line(tl.getInput('args', false));

        await createDockerEnvVarFile(envVarFilePath);

        const options = {
            failOnStdErr: false
        };

        await bash.exec(<any>options);
        tl.setResult(tl.TaskResult.Succeeded, null);
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, err);
    } finally {
        await fs.promises.unlink(envVarFilePath).catch(() => tl.warning("Unable to delete env file"));
    }
}

async function createDockerEnvVarFile(envVarFilePath: string) {
    var variableString: string = ""

    const systemVariableNames: Set<string> = new Set<string>();

    const addVariableToString = (envVarName: string, envVarValue: string) => variableString += envVarName + "=" + envVarValue + "\n"

    const addSystemVariableToString = (envVarName: string, envVarValue: string) => {
        addVariableToString(envVarName, envVarValue)
        systemVariableNames.add(envVarName)
    }

    const addInputStringToString = (envVarName: string, envVarValue: string, inputName: string,) => {
        if (envVarValue.includes("\n")) {
            throw "Input " + inputName + " is a multiline string and cannot be added to the build environment.";
        }

        addSystemVariableToString(envVarName, envVarValue)
    }

    const workingDirectory: string = tl.getInput('cwd', false) || process.env.SYSTEM_DEFAULTWORKINGDIRECTORY;
    const appLocation: string = tl.getInput(appLocationInputName, false) || "";
    const appBuildCommand: string = tl.getInput(appBuildCommandInputName, false) || "";
    const outputLocation: string = tl.getInput(outputLocationInputName, false) || "";
    const apiLocation: string = tl.getInput(apiLocationInputName, false) || "";
    const apiBuildCommand: string = tl.getInput(apiBuildCommandInputName, false) || "";
    const routesLocation: string = tl.getInput(routesLocationInputName, false) || "";
    const buildTimeoutInMinutes: string = tl.getInput(buildTimeoutInMinutesInputName, false) || "";
    const configFileLocation: string = tl.getInput(configFileLocationInputName, false) || "";
    const deploymentEnvironment: string = tl.getInput(deploymentEnvironmentInputName, false) || "";
    const productionBranch: string = tl.getInput(productionBranchInputName, false) || "";

    const skipAppBuild: boolean = tl.getBoolInput('skip_app_build', false);
    const skipApiBuild: boolean = tl.getBoolInput('skip_api_build', false);
    const isStaticExport: boolean = tl.getBoolInput('is_static_export', false);
    const apiToken: string = process.env[apiTokenInputName] || tl.getInput(apiTokenInputName, false) || "";

    const systemVerbose = getNullableBooleanFromString(process.env['SYSTEM_DEBUG']);
    const inputVerbose = getNullableBooleanFromString(tl.getInput('verbose', false));

    const verbose = inputVerbose === true ? true : (inputVerbose === false ? false : systemVerbose === true);

    const deploymentClient = "mcr.microsoft.com/appsvc/staticappsclient:stable";
    const containerWorkingDir = "/working_dir";

    addInputStringToString("APP_LOCATION", appLocation, appLocationInputName);
    addInputStringToString("APP_BUILD_COMMAND", appBuildCommand, appBuildCommandInputName);
    addInputStringToString("OUTPUT_LOCATION", outputLocation, outputLocationInputName);
    addInputStringToString("API_LOCATION", apiLocation, apiLocationInputName);
    addInputStringToString("API_BUILD_COMMAND", apiBuildCommand, apiBuildCommandInputName);
    addInputStringToString("ROUTES_LOCATION", routesLocation, routesLocationInputName);
    addInputStringToString("BUILD_TIMEOUT_IN_MINUTES", buildTimeoutInMinutes, buildTimeoutInMinutesInputName);
    addInputStringToString("CONFIG_FILE_LOCATION", configFileLocation, configFileLocationInputName);
    addInputStringToString("DEPLOYMENT_ENVIRONMENT", deploymentEnvironment, deploymentEnvironmentInputName);
    addInputStringToString("PRODUCTION_BRANCH", productionBranch, productionBranchInputName);

    addSystemVariableToString("SKIP_APP_BUILD", skipAppBuild.toString());
    addSystemVariableToString("SKIP_API_BUILD", skipApiBuild.toString());
    addSystemVariableToString("IS_STATIC_EXPORT", isStaticExport.toString());
    addSystemVariableToString("VERBOSE", verbose.toString());

    addInputStringToString("DEPLOYMENT_TOKEN", apiToken, apiTokenInputName);

    process.env['SWA_DEPLOYMENT_CLIENT'] = deploymentClient;
    process.env['SWA_WORKING_DIR'] = workingDirectory;
    process.env['SWA_WORKSPACE_DIR'] = containerWorkingDir;

    addSystemVariableToString("GITHUB_WORKSPACE", "");
    addSystemVariableToString("DEPLOYMENT_PROVIDER", "DevOps");
    addSystemVariableToString("REPOSITORY_URL", process.env.BUILD_REPOSITORY_URI || "");
    addSystemVariableToString("IS_PULL_REQUEST", "");
    addSystemVariableToString("BASE_BRANCH", "");
    addSystemVariableToString("REPOSITORY_BASE", containerWorkingDir);
    addSystemVariableToString("BRANCH", process.env.BUILD_SOURCEBRANCHNAME || process.env.BUILD_SOURCEBRANCH || "");
    addSystemVariableToString("DEPLOYMENT_ACTION", "upload");

    const denylistString = await fs.promises.readFile(path.join(__dirname, 'envVarDenylist.json'), 'utf8');
    const denylist = JSON.parse(denylistString);

    Object.keys(process.env).forEach((envVarKey: string) => {
        const envVarValue = process.env[envVarKey];

        if (envVarValue.includes("\n")) {
            tl.warning("Environment variable " + envVarKey + " is a multiline string and cannot be added to the build environment.");
            return;
        }

        if (systemVariableNames.has(envVarKey)) {
            tl.warning("custom variable overlapping with reserved SWA variable: " + envVarKey);
            return;
        }

        if (!denylist.includes(envVarKey.toUpperCase())) {
            addVariableToString(envVarKey, envVarValue);
        }
    });

    await fs.promises.writeFile(envVarFilePath, variableString);
}

function getNullableBooleanFromString(boolString: string): boolean {
    if (boolString == null) return null;
    boolString = boolString.toLowerCase();

    if (boolString === "true") {
        return true;
    }

    if (boolString === "false") {
        return false;
    }

    return null;
}

run();
