import * as tl from 'azure-pipelines-task-lib/task';
import * as os from "os";
import * as fs from "fs";
import * as path from "path";
import util from "./util";
import { IExecSyncOptions } from 'azure-pipelines-task-lib/toolrunner';
import { TelemetryEvent } from './telemetry';

export async function run() {
    let templateFilePath: string = tl.getPathInput("templateFilePath", true);
    tl.debug(`The template file path is ${templateFilePath}`);
    if (!fs.existsSync(templateFilePath)) {
        throw Error(tl.loc('TemplateFileInvalid', templateFilePath));
      }
      util.setTaskRootPath(path.dirname(templateFilePath));
    
      util.setupIotedgedev();
}