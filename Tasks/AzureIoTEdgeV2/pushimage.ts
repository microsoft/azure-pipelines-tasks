import * as path from "path";
import * as fs from "fs";
import * as tl from 'azure-pipelines-task-lib/task';
import { RegistryCredential, ACRRegistry, RegistryCredentialFactory } from './registrycredentialfactory';
import Constants from "./constant";
import util from "./util";
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';

function getRegistryAuthenticationToken(): RegistryCredential {
  // get the registry server authentication provider 
  var registryType: string = tl.getInput("containerregistrytype", true);
  let token: RegistryCredential;

  if (registryType == "Azure Container Registry") {
    let acrObject: ACRRegistry = JSON.parse(tl.getInput("azureContainerRegistry"));
    token = RegistryCredentialFactory.fetchACRCredential(tl.getInput("azureSubscriptionEndpoint"), acrObject);
  }
  else {
    token = RegistryCredentialFactory.fetchGenericCredential(tl.getInput("dockerRegistryEndpoint"));
  }

  if (token == null || token.username == null || token.password == null || token.serverUrl == null) {
    throw Error(tl.loc('ContainerRegistryInvalid', JSON.stringify(token)));
  }
  return token;
}

export async function run() {
  let registryAuthenticationToken: RegistryCredential = getRegistryAuthenticationToken();

  let bypassModules = tl.getInput('bypassModules');
  if (bypassModules == null) bypassModules = "";
  tl.debug(`Bypass Modules are: ${bypassModules}`);

  let templateFilePath: string = tl.getPathInput("templateFilePath", true);
  tl.debug(`The template file path is ${templateFilePath}`);
  if (!fs.existsSync(templateFilePath)) {
    throw Error(tl.loc('TemplateFileInvalid', templateFilePath));
  }
  util.setTaskRootPath(path.dirname(templateFilePath));

  util.setupIotedgedev();

  /* 
   * iotedgedev will use registry server url to match which credential to use in push process
   * For example, a normal docker hub credential should have server: https://index.docker.io/v1/ I would like to push to michaeljqzq/repo:0.0.1
   * But if I set CONTAINER_REGISTRY_SERVER=https://index.docker.io/v1/ in environment variable, it won't work.
   * iotedgedev won't load this credential
   * instead, the CONTAINER_REGISTRY_SERVER should be set to michaeljqzq
   * However, "michaeljqzq" is not in the scope of a credential.
   * So here is a work around to login in advanced call to `iotedgedev push` and then logout after everything done.
   */
  tl.execSync(`docker`, `login -u "${registryAuthenticationToken.username}" -p "${registryAuthenticationToken.password}" ${registryAuthenticationToken.serverUrl}`, Constants.execSyncSilentOption)

  let envList = {
    [Constants.iotedgedevEnv.bypassModules]: bypassModules,
    [Constants.iotedgedevEnv.registryServer]: registryAuthenticationToken.serverUrl,
    [Constants.iotedgedevEnv.registryUsername]: registryAuthenticationToken.username,
    [Constants.iotedgedevEnv.registryPassword]: registryAuthenticationToken.password,
  };

  // Pass task variable to sub process
  let tlVariables = tl.getVariables();
  for (let v of tlVariables) {
    // The variables in VSTS build contains dot, need to convert to underscore.
    let name = v.name.replace('.', '_').toUpperCase();
    if (!envList[name]) {
      envList[name] = v.value;
    }
  }

  tl.debug(`Following variables will be passed to the iotedgedev command: ${JSON.stringify(envList)}`);

  try {
    let execOptions: IExecOptions = {
      cwd: tl.cwd(),
      env: envList,
    } as IExecOptions;
    let defaultPlatform = tl.getInput('defaultPlatform', true);
    let command: string = `push --no-build`;
    command += ` --file ${templateFilePath}`;
    command += ` --platform ${defaultPlatform}`;
    await tl.exec(`${Constants.iotedgedev}`, command, execOptions);

    tl.execSync(`docker`, `logout`, Constants.execSyncSilentOption);
    util.createOrAppendDockerCredentials(registryAuthenticationToken);

    let dockerCredentials = util.readDockerCredentials();
    tl.debug(`Number of docker cred passed: ${dockerCredentials.length}`);

    let outputDeploymentJsonPath = tl.getVariable('_' + Constants.outputVariableDeploymentPathKey);
    if (!fs.existsSync(outputDeploymentJsonPath)) {
      tl.debug(`The generated deployment file can't be found in the path: ${outputDeploymentJsonPath}`);
    }else {
      console.log(tl.loc('DeploymentFilePath', outputDeploymentJsonPath));
      let deploymentJson = JSON.parse(fs.readFileSync(outputDeploymentJsonPath, Constants.UTF8));
      // Expand docker credentials
      // Will replace the registryCredentials if the server match
      if (dockerCredentials != undefined && util.getModulesContent(deploymentJson)['$edgeAgent']['properties.desired'].runtime.settings.registryCredentials != undefined) {
        console.log(tl.loc('ExpandingRegistryCredentials'));
        let credentials = util.getModulesContent(deploymentJson)['$edgeAgent']['properties.desired'].runtime.settings.registryCredentials;
        for (let key of Object.keys(credentials)) {
          if (credentials[key].username && (credentials[key].username.startsWith("$") || credentials[key].password.startsWith("$"))) {
            tl.debug(`Going to replace the cred in deployment.json with address: ${credentials[key].address}`);
            for (let dockerCredential of dockerCredentials) {
              if (util.isDockerServerMatch(credentials[key].address, dockerCredential.address)) {
                console.log(tl.loc('ReplaceCredential', dockerCredential.address));
                credentials[key] = dockerCredential;
                break;
              }
            }
          }
        }
      }
  
      fs.writeFileSync(outputDeploymentJsonPath, JSON.stringify(deploymentJson, null, 2));
    }
  } catch (e) {
    tl.execSync(`docker`, `logout`, Constants.execSyncSilentOption);
    throw e;
  }
}