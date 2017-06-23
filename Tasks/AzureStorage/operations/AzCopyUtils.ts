import tl = require("vsts-task-lib/task");

export function downloadAll(azCopyExeLocation: string, sourceLocationUrl: string, destLocation: string, storageAccountAccessKey: string) {
    var command = tl.tool(azCopyExeLocation);
    command.arg("-y");
    command.arg("/Source:"+sourceLocationUrl);
    command.arg("/Dest:"+destLocation);
    command.arg("/SourceKey:"+storageAccountAccessKey);
    command.arg("/S"); // to download all files from the source location.
    command.exec();
}