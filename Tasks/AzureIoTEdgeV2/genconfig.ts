import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from "fs";
import * as path from "path";
import util from "./util";
import Constants from "./constant";
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';

export async function run() {
    let templateFilePath: string = tl.getPathInput("templateFilePath", true);
    tl.debug(`The template file path is ${templateFilePath}`);
    if (!fs.existsSync(templateFilePath)) {
        throw Error(tl.loc('TemplateFileInvalid', templateFilePath));
      }
      util.setTaskRootPath(path.dirname(templateFilePath));
    
      util.setupIotedgedev();

      let outputPath = tl.getInput('deploymentManifestOutputPath', true);
      let outputFileFolder = path.dirname(outputPath);
      let outputFileName = path.basename(outputPath);
      
      let envList = process.env;
      //Set output path of iotedgedev genconfig command
      let envOverriden = false;
      if (envList[Constants.iotedgedevEnv.deploymentFileOutputFolder]) {
        tl.debug(`The ${Constants.iotedgedevEnv.deploymentFileOutputFolder} environment varialbe already exists. Will override this environment variable.`);
        envOverriden = true;
      }
      tl.debug(`Setting deployment manifest output folder to ${outputFileFolder}`);
      util.setEnvrionmentVarialbe(envList, Constants.iotedgedevEnv.deploymentFileOutputFolder, outputFileFolder);
      if (envList[Constants.iotedgedevEnv.deploymentFileOutputName]) {
        tl.debug(`The ${Constants.iotedgedevEnv.deploymentFileOutputName} environment varialbe already exists. Will override this environment variable.`);
        envOverriden = true;
      }
      tl.debug(`Setting deployment manifest output file name to ${outputFileName}`)
      util.setEnvrionmentVarialbe(envList, Constants.iotedgedevEnv.deploymentFileOutputName, outputFileName)
      if (envOverriden) {
        tl.loc("DeploymentManifestOutputPathOverridden");
      }

      // Pass secrets to sub process
      util.populateSecretToEnvironmentVariable(envList);

      let execOptions: IExecOptions = {
        cwd: tl.cwd(),
        env: envList
      } as IExecOptions;
      let defaultPlatform = tl.getInput('defaultPlatform', true);
      let command: string = `genconfig`;
      command += ` --file "${templateFilePath}"`;
      command += ` --platform "${defaultPlatform}"`;
      await tl.exec(`${Constants.iotedgedev}`, command, execOptions);

      tl.setVariable(Constants.outputVariableDeploymentPathKey, outputPath);
      tl.debug(`Set ${Constants.outputVariableDeploymentPathKey} to ${outputPath}`);
}