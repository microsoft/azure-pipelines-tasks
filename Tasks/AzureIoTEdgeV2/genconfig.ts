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
      tl.debug(`Setting deployment manifest output folder to ${outputFileFolder}`);
      util.setCliVarialbe(envList, Constants.iotedgedevEnv.deploymentFileOutputFolder, outputFileFolder);
      tl.debug(`Setting deployment manifest output file name to ${outputFileName}`)
      util.setCliVarialbe(envList, Constants.iotedgedevEnv.deploymentFileOutputName, outputFileName)

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