let fs = require("fs");
let os = require("os");
import * as tl from "azure-pipelines-task-lib";
import child = require("child_process");
import {IExecOptions, IExecSyncResult} from "azure-pipelines-task-lib/toolrunner";

export function getClientToolOptions(): IExecOptions{
    let result: IExecOptions = <IExecOptions>{
        cwd: process.cwd(),
        silent: false,
        failOnStdErr: false,
        ignoreReturnCode: false,
        windowsVerbatimArguments: false
    };
    result.outStream = process.stdout;
    result.errStream = process.stderr;
    // Filter logging-command markers out of the client tool's output before logging it.
    result.externalOutput = { source: "childProcess" };
    return result;
}

function getCommandString(toolPath: string, command: string[]){
    let cmd: string = toolPath;
    command.forEach((a: string): void => {
        cmd += ` ${a}`;
    });
    return cmd;
}

// Writes to destStream, filtering output through task-lib when configured.
function writeFiltered(destStream: NodeJS.WritableStream, data: string | Buffer, externalOutput?: IExecOptions["externalOutput"]): void {
    if (externalOutput) {
        tl.writeExternalOutput(data, { ...externalOutput, destination: destStream });
    } else {
        destStream.write(data);
    }
}

export function runClientTool(clientToolPath: string, command: string[], execOptions: IExecOptions): IExecSyncResult{

    if (tl.osType() === "Windows_NT" || clientToolPath.trim().toLowerCase().endsWith(".exe")) {
        return tl.execSync(clientToolPath, command, execOptions);
    }
    else{
        fs.chmodSync(clientToolPath, "755");

        if (!execOptions.silent) {
            writeFiltered(execOptions.outStream, getCommandString(clientToolPath, command) + os.EOL, execOptions.externalOutput);
        }

        const spawnOptions = { ...execOptions, maxBuffer: 1024 * 1024 * 1024 };

        let result = child.spawnSync(clientToolPath, command, spawnOptions);

        if (!execOptions.silent && result.stdout && result.stdout.length > 0) {
            writeFiltered(execOptions.outStream, result.stdout, execOptions.externalOutput);
        }

        if (!execOptions.silent && result.stderr && result.stderr.length > 0) {
            writeFiltered(execOptions.errStream, result.stderr, execOptions.externalOutput);
        }

        let res: IExecSyncResult = <IExecSyncResult>{ code: result.status, error: result.error };
        res.stdout = (result.stdout) ? result.stdout.toString() : null;
        res.stderr = (result.stderr) ? result.stderr.toString() : null;
        return res;
    }
}
