import tl = require("azure-pipelines-task-lib/task");
import tr = require("azure-pipelines-task-lib/toolrunner");
import * as path from 'path';

try {
    tl.setResourcePath(path.join(__dirname, "task.json"));
} catch (error) {
    tl.setResult(tl.TaskResult.Failed, error);
}

export class goExe {
    private command: string = "";
    private argument: string = "";
    private workingDir: string = "";

    constructor() {
        this.command = tl.getInput("command", true).trim();
        if (this.command == "custom") {
            this.command = tl.getInput("customCommand", true).trim();
        }
        this.argument = tl.getInput("arguments", false);
        this.workingDir = tl.getInput("workingDirectory", false);
    }

    public async execute() {
        let goPath = tl.which("go", true);
        let go: tr.ToolRunner = tl.tool(goPath);

        go.arg(this.command);
        go.line(this.argument);

        return await go.exec(<tr.IExecOptions>{
            cwd: this.workingDir
        });
    }
}

var exe = new goExe();
exe.execute().catch((reason) => tl.setResult(tl.TaskResult.Failed, tl.loc("TaskFailedWithError", reason)));