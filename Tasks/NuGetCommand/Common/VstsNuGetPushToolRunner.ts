import {IExecOptions, IExecSyncResult, ToolRunner} from "vsts-task-lib/toolrunner";
import * as auth from "nuget-task-common/Authentication";
import * as tl from "vsts-task-lib/task";
import * as path from "path";
import semver = require('semver');

export interface VstsNuGetPushSettings {
    continueOnConflict: boolean;
}

function initializeExecutionOptions(options: IExecOptions, settings: VstsNuGetPushSettings): IExecOptions {
    options = options || <IExecOptions>{};
    if (settings.continueOnConflict)
    {
        options.ignoreReturnCode = true;
    }
    return options;
}

export class VstsNuGetPushToolRunner extends ToolRunner {
    private settings: VstsNuGetPushSettings;
    private authInfo: auth.InternalAuthInfo;

    constructor(vstsNuGetPushPath: string, settings: VstsNuGetPushSettings, authInfo: auth.InternalAuthInfo) {
        if (tl.osType() === 'Windows_NT' || !vstsNuGetPushPath.trim().toLowerCase().endsWith(".exe")) {
            super(vstsNuGetPushPath);
        }
        else {
            // TODO: check if it works with mono
            let monoPath = tl.which("mono", true);
            super(monoPath);
            this.arg(vstsNuGetPushPath);
        }

        this.settings = settings;
        this.authInfo = authInfo;
    }

    public execSync(options?: IExecOptions): IExecSyncResult {
        options = initializeExecutionOptions(options, this.settings);
        let execResult = super.execSync(options);
        if (execResult.code !== 0) {
            this._logExecResults(execResult.code, execResult.stderr);
        }
        return execResult;
    }

    public exec(options?: IExecOptions): Q.Promise<number> {
        options = initializeExecutionOptions(options, this.settings);

        return super.exec(options);
    }

    private _logExecResults(exitCode: number, stderr: string){
        try {
            let agentVersion = tl.getVariable('Agent.Version');
            if (semver.gte(agentVersion, '2.120.0')) {
                console.log("##vso[telemetry.publish area=Packaging;feature=NuGetCommand]%s",
                    JSON.stringify({
                        'SYSTEM_JOBID': tl.getVariable('SYSTEM_JOBID'),
                        'SYSTEM_PLANID': tl.getVariable('SYSTEM_PLANID'),
                        'SYSTEM_COLLECTIONID': tl.getVariable('SYSTEM_COLLECTIONID'),
                        'command': tl.getInput("command"),
                        'arguments': tl.getInput("arguments"),
                        'exitCode': exitCode,
                        'stderr': (stderr) ? stderr.substr(0, 1024) : null
                    }));
            } else {
                tl.debug(`Agent version of ( ${agentVersion} ) does not meet minimum reqiurements for telemetry`);
            }
        } catch (err) {
            tl.debug(`Unable to log telemetry. Err:( ${err} )`);
        }
    }
}

export function createVstsNuGetPushToolRunner(vstsNuGetPushPath: string, settings: VstsNuGetPushSettings, authInfo: auth.InternalAuthInfo): VstsNuGetPushToolRunner {
    let runner = new VstsNuGetPushToolRunner(vstsNuGetPushPath, settings, authInfo);
    runner.on("debug", message => tl.debug(message));
    return runner;
}