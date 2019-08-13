import * as fs from "fs";
import * as path from "path";
import * as tl from "azure-pipelines-task-lib/task";

export function getPypircPath(): string {
    let pypircPath: string;
    if (tl.getVariable("PYPIRC_PATH")) {
        pypircPath = tl.getVariable("PYPIRC_PATH");
    }
    else {
       let tempPath = tl.getVariable("Agent.TempDirectory");
       tempPath = path.join(tempPath, "twineAuthenticate");
       tl.mkdirP(tempPath);
       let savePypircPath = fs.mkdtempSync(tempPath + path.sep);
       pypircPath = savePypircPath + path.sep + ".pypirc";
    }
    return pypircPath;
}
