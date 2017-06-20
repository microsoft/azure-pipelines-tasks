import tl = require("vsts-task-lib/task");

//Upload // AzCopy.exe /Source:C:\artifacts /Dest:https://vaibhavjenkins.blob.core.windows.net/artifacts-container /DestKey:KeCw3XQbe5T6BRtr8ua4wGR+kaRUfFUcuPQobCmlEE5gAtdOTzmffy4CVXiOOsCppEn1xD35X27g89bxtXLCAw== /Pattern:TaskList.zip
//Download // AzCopy.exe /Source:https://vaibhavjenkins.blob.core.windows.net/artifacts-container /Dest:C:\ /SourceKey:KeCw3XQbe5T6BRtr8ua4wGR+kaRUfFUcuPQobCmlEE5gAtdOTzmffy4CVXiOOsCppEn1xD35X27g89bxtXLCAw== /Pattern:TaskList.zip

export function downloadAll(azCopyExeLocation: string, sourceLocationUrl: string, destLocation: string, storageAccountAccessKey: string) {
    var command = tl.tool(azCopyExeLocation);
    command.arg("-y");
    command.arg("/Source:"+sourceLocationUrl);
    command.arg("/Dest:"+destLocation);
    command.arg("/SourceKey:"+storageAccountAccessKey);
    command.arg("/S");
    command.exec();
}