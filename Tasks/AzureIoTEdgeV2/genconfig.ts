import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from "fs";
import * as path from "path";
import util from "./util";
import Constants from "./constant";

export async function run() {
    let templateFilePath: string = tl.getPathInput("templateFilePath", true);
    tl.debug(`The template file path is ${templateFilePath}`);
    if (!fs.existsSync(templateFilePath)) {
        throw Error(tl.loc('TemplateFileInvalid', templateFilePath));
      }
      util.setTaskRootPath(path.dirname(templateFilePath));
    
      util.setupIotedgedev();
    
      tl.setVariable(Constants.iotedgedevEnv.deploymentFileOutputFolder, tl.getVariable(Constants.outputFileFolder));

      let defaultPlatform = tl.getInput('defaultPlatform', true);
      let command: string = `genconfig`;
      command += ` --file "${templateFilePath}"`;
      command += ` --platform "${defaultPlatform}"`;
      await tl.exec(`${Constants.iotedgedev}`, command);
}