import * as fs from "fs";
import * as path from "path";
import * as tl from 'azure-pipelines-task-lib/task';
import * as os from "os";
import util from "./util";
import Constants from "./constant";
import { IExecSyncOptions } from 'azure-pipelines-task-lib/toolrunner';
import { TelemetryEvent } from './telemetry';

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

      let script1 = `iot edge deployment delete --hub-name ${iothub} --config-id ${configId}`;
      let script2 = `iot edge deployment create --config-id ${configId} --hub-name ${iothub} --content ${deploymentJsonPath} --target-condition ${targetCondition} --priority ${priority}`;

      this.loginAzure();

      tl.debug('OS release:' + os.release());

      // WORK AROUND
      // In Linux environment, sometimes when install az extension, libffi.so.5 file is missing. Here is a quick fix.
      let addResult = tl.execSync('az', 'extension add --name azure-cli-iot-ext --debug', Constants.execSyncSilentOption);
      tl.debug(JSON.stringify(addResult));
      if (addResult.code === 1) {
        if (addResult.stderr.includes('ImportError: libffi.so.5')) {
          let azRepo = tl.execSync('lsb_release', '-cs', Constants.execSyncSilentOption).stdout.trim();
          console.log(`\n--------------------Error--------------------.\n Something wrong with built-in Azure CLI in agent, can't install az-cli-iot-ext.\nTry to fix with reinstall the ${azRepo} version of Azure CLI.\n\n`);
          tl.debug(JSON.stringify(tl.execSync('sudo', 'rm /etc/apt/sources.list.d/azure-cli.list', Constants.execSyncSilentOption)));
          // fs.writeFileSync('sudo', `/etc/apt/sources.list.d/azure-cli.list deb [arch=amd64] https://packages.microsoft.com/repos/azure-cli/ ${azRepo} main`, Constants.execSyncSilentOption));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'cat /etc/apt/sources.list.d/azure-cli.list', Constants.execSyncSilentOption)));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'apt-key adv --keyserver packages.microsoft.com --recv-keys 52E16F86FEE04B979B07E28DB02C46DF417A0893', Constants.execSyncSilentOption)));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'apt-get install apt-transport-https', Constants.execSyncSilentOption)));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'apt-get update', Constants.execSyncSilentOption)));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'apt-get --assume-yes remove azure-cli', Constants.execSyncSilentOption)));
          tl.debug(JSON.stringify(tl.execSync('sudo', 'apt-get --assume-yes install azure-cli', Constants.execSyncSilentOption)));
          let r = tl.execSync('az', 'extension add --name azure-cli-iot-ext --debug', Constants.execSyncSilentOption);
          tl.debug(JSON.stringify(r));
          if (r.code === 1) {
            throw new Error(r.stderr);
          }
        } else if (addResult.stderr.includes('The extension azure-cli-iot-ext already exists')) {
          // The job contains multiple deploy tasks
          // do nothing
        } else {
          throw new Error(addResult.stderr);
        }
      }

      try {
        let iotHubInfo = JSON.parse(tl.execSync('az', `iot hub show -n ${iothub}`, Constants.execSyncSilentOption).stdout);
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

      let result1 = tl.execSync('az', script1, Constants.execSyncSilentOption);
      let result2 = await tl.exec('az', script2);
      if (result2 !== 0) {
        throw new Error(`Error for deployment`);
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
      let result = tl.execSync("az", `cloud set --name ${environment}`, Constants.execSyncSilentOption);
      tl.debug(JSON.stringify(result));
    }

    //login using svn
    let result = tl.execSync("az", "login --service-principal -u \"" + servicePrincipalId + "\" -p \"" + servicePrincipalKey + "\" --tenant \"" + tenantId + "\"", Constants.execSyncSilentOption);
    tl.debug(JSON.stringify(result));
    this.throwIfError(result);
    this.isLoggedIn = true;
    //set the subscription imported to the current subscription
    result = tl.execSync("az", "account set --subscription \"" + subscriptionName + "\"", Constants.execSyncSilentOption);
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

  static createFile(filePath, data) {
    try {
      fs.writeFileSync(filePath, data);
    }
    catch (err) {
      this.deleteFile(filePath);
      throw err;
    }
  }

  static deleteFile(filePath) {
    if (fs.existsSync(filePath)) {
      try {
        //delete the publishsetting file created earlier
        fs.unlinkSync(filePath);
      }
      catch (err) {
        //error while deleting should not result in task failure
        console.error(err.toString());
      }
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

    var executionError = null;
    try {
      let modules = deploymentJson.modulesContent.$edgeAgent["properties.desired"].modules;
      if (modules) {
        tl.debug("Logging out all registries.");
        Object.keys(modules).forEach((key: string) => {
          let module = modules[key];
          let image = module.settings.image as string;
          let hostNameString = this.getDomainName(image);
          let result = tl.execSync("docker", `logout ${hostNameString}`, Constants.execSyncSilentOption);
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
          let loginResult = tl.execSync("docker", `login ${credential.address} -u ${credential.username} -p ${credential.password}`, Constants.execSyncSilentOption);
          tl.debug(JSON.stringify(loginResult));
          if (loginResult.code != 0) {
            tl.warning(tl.loc("InvalidRegistryCredentialWarning", credential.address, loginResult.stderr));
          }
        });
      }

      tl.setVariable("DOCKER_CLI_EXPERIMENTAL", "enabled");
      tl.debug(`Checking DOCKER_CLI_EXPERIMENTAL value: ${tl.getVariable("DOCKER_CLI_EXPERIMENTAL")}`);
      let validationErr = "";
      Object.keys(modules).forEach((key: string) => {
        let module = modules[key];
        let image = module.settings.image;
        let manifestResult = tl.execSync("docker", `manifest inspect ${image}`, Constants.execSyncSilentOption);
        tl.debug(JSON.stringify(manifestResult));
        if (manifestResult.code != 0) {
          validationErr += tl.loc("CheckModuleImageExistenceError", image, manifestResult.stderr) + "\n";
        }
      });
      if (validationErr) {
        throw new Error(validationErr);
      }
    }
    catch (err) {
      if (err.stderr) {
        executionError = err.stderr;
      }
      else {
        executionError = err;
      }
    }
    finally {
      //set the task result to either succeeded or failed based on error was thrown or not
      if (executionError) {
        throw new Error(executionError);
      }
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