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
      tl.debug(`Setting deployment manifest output folder to ${outputFileFolder}`);
      util.setEnvrionmentVarialbe(envList, Constants.iotedgedevEnv.deploymentFileOutputFolder, outputFileFolder);
      tl.debug(`Setting deployment manifest output file name to ${outputFileName}`)
      util.setEnvrionmentVarialbe(envList, Constants.iotedgedevEnv.deploymentFileOutputName, outputFileName)
      
      // Pass task variable to sub process
      let tlVariables = tl.getVariables();
      for (let v of tlVariables) {
        // The variables in VSTS build contains dot, need to convert to underscore.
        if (v.secret){
          let envName = v.name.replace('.', '_').toUpperCase();
          tl.debug(`Setting environment varialbe ${envName} to the value of secret: ${v.name}`);
          if (!envList[envName]) {
            envList[envName] = v.value;
          } else {
            tl.warning(`Environment variable ${envName} already exist. Skip setting environment varialbe for secret: ${v.name}.`);
          }
        }
      }

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