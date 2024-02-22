import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from "fs";
import * as path from "path";
import util from "./util";
import Constants from "./constant";
import { IExecOptions } from 'azure-pipelines-task-lib/toolrunner';
import { TaskError } from './taskerror'

export async function run() {
  let templateFilePath: string = tl.getPathInput("templateFilePath", true);
  tl.debug(`The template file path is ${templateFilePath}`);
  if (!fs.existsSync(templateFilePath)) {
    throw new TaskError('The path of template file is not valid', tl.loc('TemplateFileInvalid', templateFilePath));
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
    env: envList,
    shell: true,
  } as IExecOptions;
  let defaultPlatform = tl.getInput('defaultPlatform', true);
  let genConfigCommand = ["genconfig", "--file", templateFilePath, "--platform", defaultPlatform];
  let validateGeneratedDeploymentManifest = tl.getBoolInput('validateGeneratedDeploymentManifest', false);
  tl.debug(`validateGeneratedDeploymentManifest: ${validateGeneratedDeploymentManifest}`);
  if (validateGeneratedDeploymentManifest) {
    genConfigCommand.push("--fail-on-validation-error")
  }
  await tl.exec(`${Constants.iotedgedev}`, genConfigCommand, execOptions);

  tl.setVariable(Constants.outputVariableDeploymentPathKey, outputPath);
  tl.debug(`Set ${Constants.outputVariableDeploymentPathKey} to ${outputPath}`);
}
