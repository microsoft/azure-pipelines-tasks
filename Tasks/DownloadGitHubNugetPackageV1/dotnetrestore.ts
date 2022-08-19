import tl = require("azure-pipelines-task-lib/task");
import tr = require("azure-pipelines-task-lib/toolrunner");
import path = require("path");

import * as restoreCommand from './restorecommand';

// some test changes

let MessagePrinted = false;

export class dotNetExe {

    constructor() {
    }

    public async execute() {
        tl.setResourcePath(path.join(__dirname, "task.json"));
        this.setConsoleCodePage();

        try {
            await restoreCommand.run();
        }
        finally {
            if (!MessagePrinted) {
               console.log(tl.loc('NetCore3Update'));
            }
        }
    }

    private setConsoleCodePage() {
        // set the console code page to "UTF-8"
        if (tl.osType() === 'Windows_NT') {
            try {
                tl.execSync(path.resolve(process.env.windir, "system32", "chcp.com"), ["65001"]);
            }
            catch (ex) {
                tl.warning(tl.loc("CouldNotSetCodePaging", JSON.stringify(ex)))
            }
        }
    }
}

var exe = new dotNetExe();
exe.execute().catch((reason) => tl.setResult(tl.TaskResult.Failed, reason));
