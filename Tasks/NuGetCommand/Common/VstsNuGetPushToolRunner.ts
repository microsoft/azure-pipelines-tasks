import {IExecOptions, IExecSyncResult, ToolRunner} from "vsts-task-lib/toolrunner";
import * as auth from "nuget-task-common/Authentication";
import * as tl from "vsts-task-lib/task";
import * as path from "path";
import * as telemetry from 'utility-common/telemetry';

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
        return execResult;
    }

    public exec(options?: IExecOptions): Q.Promise<number> {
        options = initializeExecutionOptions(options, this.settings);

        return super.exec(options);
    }
}

export function createVstsNuGetPushToolRunner(vstsNuGetPushPath: string, settings: VstsNuGetPushSettings, authInfo: auth.InternalAuthInfo): VstsNuGetPushToolRunner {
    let runner = new VstsNuGetPushToolRunner(vstsNuGetPushPath, settings, authInfo);
    runner.on("debug", message => tl.debug(message));
    return runner;
}
