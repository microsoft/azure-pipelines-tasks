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
    
      let envList = {
        [Constants.iotedgedevEnv.deploymentFileOutputFolder]: tl.getVariable(Constants.outputFileFolder),
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

      let execOptions: IExecOptions = {
        cwd: tl.cwd(),
        env: envList
      } as IExecOptions;
      let defaultPlatform = tl.getInput('defaultPlatform', true);
      let command: string = `genconfig`;
      command += ` --file "${templateFilePath}"`;
      command += ` --platform "${defaultPlatform}"`;
      await tl.exec(`${Constants.iotedgedev}`, command, execOptions);
}