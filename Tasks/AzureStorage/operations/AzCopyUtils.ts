import tl = require("vsts-task-lib/task");
import util = require("util");
import path = require("path");
import fs = require("fs");

export class AzCopyUtils
{
    public azCopyExeLocation: string;

    constructor() {
        this.azCopyExeLocation = path.join(__dirname, '..', 'AzCopy', 'AzCopy.exe');
    }

    public async downloadAll(sourceLocationUrl: string, destLocation: string, storageAccountAccessKey: string) {
        if(!fs.existsSync(this.azCopyExeLocation)) {
            throw new Error("AzCopy.exe does not exist in the required path");
        }

        var command = tl.tool(this.azCopyExeLocation);
        command.arg("-y");
        command.arg(util.format("/Source:%s", sourceLocationUrl));
        command.arg(util.format("/Dest:%s", destLocation));
        command.arg(util.format("/SourceKey:%s",storageAccountAccessKey));
        command.arg("/S"); // to download all files from the source location.
        await command.exec().fail(function(error) {
            throw error;
        });
    }
}