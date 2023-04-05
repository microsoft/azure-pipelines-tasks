import * as fs from "fs";
import * as path from "path";
import * as tl from 'azure-pipelines-task-lib/task';
import * as os from "os";
import util from "./util";
import Constants from "./constant";
import { TelemetryEvent } from './telemetry';
import * as stream from "stream";
import EchoStream from './echostream';
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';
import { TaskError } from './taskerror';

class azureclitask {
  private static isLoggedIn = false;
  static checkIfAzurePythonSdkIsInstalled() {
    return !!tl.which("az", false);
  }

  static async runMain(deploymentJson, telemetryEvent: TelemetryEvent) {
    var toolExecutionError = null;
    try {
      let iothub: string = tl.getInput("iothubname", true);
      let configId: string = tl.getInput("deploymentid", true);
      let priorityInput: string = tl.getInput("priority", true);
      let deviceOption: string = tl.getInput("deviceOption", true);
      let targetCondition: string;

      if (deviceOption === 'Single Device') {
        let deviceId: string = tl.getInput("deviceId", true);
        targetCondition = `deviceId='${deviceId}'`;
      } else {
        targetCondition = tl.getInput("targetcondition", true);
      }

      let deploymentJsonPath: string = path.resolve(os.tmpdir(), `deployment_${new Date().getTime()}.json`);
      fs.writeFileSync(deploymentJsonPath, JSON.stringify({ content: deploymentJson }, null, 2));

      let priority: number = parseInt(priorityInput);
      priority = isNaN(priority) ? 0 : priority;

      configId = util.normalizeDeploymentId(configId);
      console.log(tl.loc('NomralizedDeployementId', configId));

      this.loginAzure();

      tl.debug('OS release:' + os.release());      
      let showIotExtensionCommand = ["extension", "show", "--name", "azure-iot"];
      let result = tl.execSync('az', showIotExtensionCommand, Constants.execSyncSilentOption);
      if (result.code !== 0) { // The extension is not installed
        let installFixedIotExtensionCommand = ["extension", "add", "--source", Constants.azureCliIotExtensionDefaultSource, "-y", "--debug"];
        let installLatestIotExtensionCommand = ["extension", "add", "--name", "azure-iot", "--debug"];
        try {
          this.installAzureCliIotExtension(installFixedIotExtensionCommand);
          telemetryEvent.fixedCliExtInstalled = true;
        }
        catch (err) {
          // Install latest IoT extension if installing fixed version failed
          this.installAzureCliIotExtension(installLatestIotExtensionCommand);
          telemetryEvent.fixedCliExtInstalled = false;
        }
      }

      try {
        let iotHubInfo = JSON.parse(tl.execSync('az', ["iot", "hub", "show", "-n", iothub], Constants.execSyncSilentOption).stdout);
        tl.debug(`The host name of iot hub is ${iotHubInfo.properties.hostName}`);
        telemetryEvent.iotHubHostNameHash = util.sha256(iotHubInfo.properties.hostName);
        let reg = new RegExp(iothub + "\.(.*)");
        let m = reg.exec(iotHubInfo.properties.hostName);
        if (m && m[1]) {
          telemetryEvent.iotHubDomain = m[1];
        }
      } catch (e) {
        // If error when get iot hub information, ignore.
      }

      let outputStream: EchoStream = new EchoStream();
      let execOptions: IExecOptions = {
        errStream: outputStream as stream.Writable,
        shell: true,
      } as IExecOptions;

      let result1 = tl.execSync('az', ["iot", "edge", "deployment", "delete", "--hub-name", iothub, "--deployment-id", configId], Constants.execSyncSilentOption);
      let result2 = await tl.exec('az', ["iot", "edge", "deployment", "create", "--deployment-id", configId, "--hub-name", iothub, "--content", deploymentJsonPath, "--target-condition", targetCondition, "--priority", priority.toString(), "--output", "none"], execOptions);
      if (result2 !== 0) {
        throw new Error(`Failed to create deployment. Error: ${outputStream.content}`);
      }
    }
    catch (err) {
      if (err.stderr) {
        toolExecutionError = err.stderr;
      }
      else {
        toolExecutionError = err;
      }
      //go to finally and logout of azure and set task result
    }
    finally {
      //Logout of Azure if logged in
      if (this.isLoggedIn) {
        this.logoutAzure();
      }

      //set the task result to either succeeded or failed based on error was thrown or not
      if (toolExecutionError) {
        throw new Error(toolExecutionError);
      }
      else {
        // tl.setResult(tl.TaskResult.Succeeded, tl.loc("ScriptReturnCode", 0));
      }
    }
  }

  static installAzureCliIotExtension(installCommand: string[]) {
    let outputStream: EchoStream = new EchoStream();
    let execOptions: IExecOptions = {
      errStream: outputStream as stream.Writable
    } as IExecOptions;
    
    // check azcli version
    let checkAzureIoTVersionExtensionCommand = ["--version"]; 
    let viewAzVersionResult = tl.execSync('az', checkAzureIoTVersionExtensionCommand, execOptions);
    if(viewAzVersionResult.code !== 0)
    {
      throw new Error(`View Az Version Error: ${outputStream.content}`);
    }

    let addResult = tl.execSync('az', installCommand, Constants.execSyncSilentOption);
    tl.debug(JSON.stringify(addResult));
    if (addResult.code !== 0) {
        throw new Error(addResult.stderr);
    }
  }

  static loginAzure() {
    var connectedService = tl.getInput("connectedServiceNameARM", true);
    this.loginAzureRM(connectedService);
  }

  static loginAzureRM(connectedService) {
    var servicePrincipalId = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
    var servicePrincipalKey = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalkey", false);
    var tenantId = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false);
    var subscriptionName = tl.getEndpointDataParameter(connectedService, "SubscriptionName", true);
    var environment = tl.getEndpointDataParameter(connectedService, "environment", true);
    // Work around for build agent az command will exit with non-zero code since configuration files are missing.
    tl.debug(tl.execSync("az", "--version", Constants.execSyncSilentOption).stdout);

    // Set environment if it is not AzureCloud (global Azure)
    if (environment && environment !== 'AzureCloud') {
      let result = tl.execSync("az", ["cloud", "set", "--name", environment], Constants.execSyncSilentOption);
      tl.debug(JSON.stringify(result));
    }

    //login using svn
    let result = tl.execSync("az", ["login", "--service-principal", "-u", servicePrincipalId, "-p", servicePrincipalKey, "--tenant", tenantId], Constants.execSyncSilentOption);
    tl.debug(JSON.stringify(result));
    this.throwIfError(result);
    this.isLoggedIn = true;
    //set the subscription imported to the current subscription
    result = tl.execSync("az", ["account", "set", "--subscription", subscriptionName], Constants.execSyncSilentOption);
    tl.debug(JSON.stringify(result));
    this.throwIfError(result);
  }

  static logoutAzure() {
    try {
      tl.debug(tl.execSync("az", " account clear", Constants.execSyncSilentOption).stdout);
    }
    catch (err) {
      // task should not fail if logout doesn`t occur
      tl.warning(tl.loc("FailedToLogout"));
    }
  }

  static throwIfError(resultOfToolExecution) {
    if (resultOfToolExecution.stderr) {
      throw resultOfToolExecution;
    }
  }
}

class imagevalidationtask {
  static async runMain(deploymentJson) {
    let skipValidation = tl.getVariable("SKIP_MODULE_IMAGE_VALIDATION");
    if (skipValidation && skipValidation.toLowerCase() === "true") {
      console.log(tl.loc("SkipModuleImageValidation"));
      return;
    }

    try {
      let modules = deploymentJson.modulesContent.$edgeAgent["properties.desired"].modules;
      if (modules) {
        tl.debug("Logging out all registries.");
        Object.keys(modules).forEach((key: string) => {
          let module = modules[key];
          let image = module.settings.image as string;
          let hostNameString = this.getDomainName(image);
          let result = tl.execSync("docker", ["logout", hostNameString], Constants.execSyncSilentOption);
          tl.debug(JSON.stringify(result));
        });
      } else {
        tl.debug("No custom modules found in deployment.json");
        return; // There is no custom module so do not need to validate
      }

      let credentials = deploymentJson.modulesContent.$edgeAgent["properties.desired"].runtime.settings.registryCredentials;
      if (credentials) {
        Object.keys(credentials).forEach((key: string) => {
          let credential = credentials[key];
          let loginResult = tl.execSync("docker", ["login", credential.address, "-u", credential.username, "-p", credential.password], Constants.execSyncSilentOption);
          tl.debug(JSON.stringify(loginResult));
          if (loginResult.code != 0) {
            tl.warning(tl.loc("InvalidRegistryCredentialWarning", credential.address, loginResult.stderr));
          } else {
            tl.loc("LoginRegistrySucess", credential.address);
          }
        });
      } else {
        tl.debug("No registry credentials found in deployment manifest.")
      }

      tl.setVariable("DOCKER_CLI_EXPERIMENTAL", "enabled");
      tl.debug(`Checking DOCKER_CLI_EXPERIMENTAL value: ${tl.getVariable("DOCKER_CLI_EXPERIMENTAL")}`);
      let validationErr = "";
      Object.keys(modules).forEach((key: string) => {
        let module = modules[key];
        let image = module.settings.image;
        let manifestResult = tl.execSync("docker", ["manifest", "inspect", image], Constants.execSyncSilentOption);
        tl.debug(JSON.stringify(manifestResult));
        if (manifestResult.code != 0) {
          validationErr += tl.loc("CheckModuleImageExistenceError", image, manifestResult.stderr) + "\n";
        }
      });
      if (validationErr) {
        throw new TaskError('One or more modules do not exist or the credential is not set correctly', validationErr);
      }
    }
    catch (err) {
      if (err.stderr) {
        throw new Error(err.stderr);
      }
      throw err;
    }
  }

  static getDomainName(name: string) {
    let i = name.indexOf('/');
    if (i == -1 || (!name.substr(0, i).match(/\.|:/))) { // The image is in docker hub
      return "";
    } else {
      return name.substr(0, i);
    }
  }
}

export async function run(telemetryEvent: TelemetryEvent) {
  let inBuildPipeline: boolean = util.checkSelfInBuildPipeline();
  console.log(tl.loc('DeployTaskRunningInBuild', inBuildPipeline));
  let deploymentFilePath: string = tl.getPathInput('deploymentFilePath', true);

  // Find the deployment.json file
  let findPaths: string[] = util.findFiles(deploymentFilePath);
  tl.debug(`Found ${findPaths.length} result for deployment file: ${deploymentFilePath}`);
  if (!findPaths || findPaths.length === 0) {
    throw new Error(tl.loc('DeploymentFileNotFound'));
  }

  for (let path of findPaths) {
    console.log(path);
  }

  let deploymentJson: any = null;
  for (let path of findPaths) {
    console.log(tl.loc('CheckValidJson', path));
    try {
      deploymentJson = JSON.parse(fs.readFileSync(path, Constants.UTF8));
    } catch (e) {
      console.log(tl.loc('Invalid'));
      continue;
    }
    console.log(tl.loc('Valid'));
    break;
  }

  if (deploymentJson == null) {
    throw new Error(tl.loc('ValidDeploymentFileNotFound'));
  }

  if (!azureclitask.checkIfAzurePythonSdkIsInstalled()) {
    throw new Error(tl.loc('AzureSdkNotFound'));
  }
  await imagevalidationtask.runMain(deploymentJson);
  await azureclitask.runMain(deploymentJson, telemetryEvent);
}
