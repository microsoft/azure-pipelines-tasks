import path = require('path');
import tl = require('azure-pipelines-task-lib/task');
import trm = require('azure-pipelines-task-lib/toolrunner');
import fs = require('fs');

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

        createDockerEnvVarFile(envVarFilePath)
        
        const options = {
            failOnStdErr: false
        };

        await bash.exec(<any>options);
        tl.setResult(tl.TaskResult.Succeeded, null);
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, null);
    } finally {
        await fs.unlink(envVarFilePath, (error) => {
            if(error) throw error;
        });
    }
}

async function createDockerEnvVarFile(envVarFilePath: string) {
    const taskVariables = tl.getVariables();
    var variableString: string = ""

    const systemVariableNames: Set<string> = new Set<string>();

    const addVariableToString = (variableName: string, variableValue: string) => variableString += variableName + "=" + variableValue + "\n"

    const addSystemVariableToString = (variableName: string, variableValue: string) => {
        addVariableToString(variableName, variableValue)
        systemVariableNames.add(variableName)
    }

    const workingDirectory: string = tl.getInput('cwd', false) || "";
    const appLocation: string = tl.getInput('app_location', false) || "";
    const appBuildCommand: string = tl.getInput('app_build_command', false) || "";
    const outputLocation: string = tl.getInput('output_location', false) || "";
    const apiLocation: string = tl.getInput('api_location', false) || "";
    const apiBuildCommand: string = tl.getInput('api_build_command', false) || "";
    const routesLocation: string = tl.getInput('routes_location', false) || "";
    const buildTimeoutInMinutes: string = tl.getInput('build_timeout_in_minutes', false) || "";
    const configFileLocation: string = tl.getInput('config_file_location', false) || "";
    const skipAppBuild: boolean = tl.getBoolInput('skip_app_build', false);
    const apiToken: string = process.env['azure_static_web_apps_api_token'] || tl.getInput('azure_static_web_apps_api_token', false) || "";

    const systemVerbose = getNullableBooleanFromString(process.env['SYSTEM_DEBUG']);
    const inputVerbose = getNullableBooleanFromString(tl.getInput('verbose', false));

    const verbose = inputVerbose === true ? true : (inputVerbose === false ? false : systemVerbose === true);
    
    const deploymentClient = "mcr.microsoft.com/appsvc/staticappsclient:stable";

    addSystemVariableToString("APP_LOCATION", appLocation);
    addSystemVariableToString("APP_BUILD_COMMAND", appBuildCommand);
    addSystemVariableToString("OUTPUT_LOCATION", outputLocation);
    addSystemVariableToString("API_LOCATION", apiLocation);
    addSystemVariableToString("API_BUILD_COMMAND", apiBuildCommand);
    addSystemVariableToString("ROUTES_LOCATION", routesLocation);
    addSystemVariableToString("BUILD_TIMEOUT_IN_MINUTES", buildTimeoutInMinutes);
    addSystemVariableToString("CONFIG_FILE_LOCATION", configFileLocation);

    addSystemVariableToString("SKIP_APP_BUILD", skipAppBuild.toString());
    addSystemVariableToString("VERBOSE", verbose.toString());

    addSystemVariableToString("DEPLOYMENT_TOKEN", apiToken);

    process.env['SWA_WORKING_DIR'] = workingDirectory;
    process.env['SWA_DEPLOYMENT_CLIENT'] = deploymentClient;

    systemVariableNames.add("GITHUB_WORKSPACE")
    systemVariableNames.add("DEPLOYMENT_PROVIDER")
    systemVariableNames.add("REPOSITORY_URL")
    systemVariableNames.add("IS_PULL_REQUEST")
    systemVariableNames.add("BASE_BRANCH")

    taskVariables.forEach((taskVariable) => {
        if (systemVariableNames.has(taskVariable.name)) {
            tl.warning("custom variable overlapping with reserved SWA variable: " + taskVariable.name)
        } else {
            addVariableToString(taskVariable.name, taskVariable.value)
        }
    })

    await fs.writeFile(envVarFilePath, variableString, (error) => {
        if(error) throw error;
    });
}

function getNullableBooleanFromString(boolString:string): boolean {
    if (boolString == null) return null;
    boolString = boolString.toLowerCase();

    if(boolString === "true") {
        return true;
    }

    if(boolString === "false") {
        return false;
    }

    return null;
}

run();