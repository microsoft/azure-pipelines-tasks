import * as tl from "azure-pipelines-task-lib/task";
import {IExecOptions, IExecSyncResult, ToolRunner} from "azure-pipelines-task-lib/toolrunner";
import * as auth from "azure-pipelines-tasks-packaging-common/nuget/Authentication";
import Q = require("q");

export interface VstsNuGetPushSettings {
    continueOnConflict: boolean;
    timeoutInMs?: number;
}

function initializeExecutionOptions(options: IExecOptions | undefined, settings: VstsNuGetPushSettings): IExecOptions {
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

        const timeoutInMs = this.settings.timeoutInMs;
        if (timeoutInMs === undefined) {
            return super.exec(options);
        }

        const deferred = Q.defer<number>();
        let timedOut = false;
        const timeoutHandle = setTimeout(() => {
            timedOut = true;
            tl.debug(`VstsNuGetPush.exe timed out after ${timeoutInMs} ms. Terminating process.`);
            this.killChildProcess();
        }, timeoutInMs);

        super.exec(options).then((result: number) => {
            clearTimeout(timeoutHandle);
            if (timedOut) {
                deferred.reject(new Error(tl.loc("Error_PublishRequestTimedOut", timeoutInMs.toString())));
                return;
            }

            deferred.resolve(result);
        }, (error: Error) => {
            clearTimeout(timeoutHandle);
            if (timedOut) {
                deferred.reject(new Error(tl.loc("Error_PublishRequestTimedOut", timeoutInMs.toString())));
                return;
            }

            deferred.reject(error);
        }).done();

        return deferred.promise;
    }
}

export function createVstsNuGetPushToolRunner(vstsNuGetPushPath: string, settings: VstsNuGetPushSettings, authInfo: auth.InternalAuthInfo): VstsNuGetPushToolRunner {
    let runner = new VstsNuGetPushToolRunner(vstsNuGetPushPath, settings, authInfo);
    runner.on("debug", message => tl.debug(message));
    return runner;
}
