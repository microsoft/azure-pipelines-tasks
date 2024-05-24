import * as path from "path";
import * as Q  from "q";
import * as tl from "azure-pipelines-task-lib/task";
import {IExecOptions} from "azure-pipelines-task-lib/toolrunner";

import * as auth from "azure-pipelines-tasks-packaging-common/nuget/Authentication";
import INuGetCommandOptions from "azure-pipelines-tasks-packaging-common/nuget/INuGetCommandOptions";
import {NuGetConfigHelper} from "azure-pipelines-tasks-packaging-common/nuget/NuGetConfigHelper";
import * as ngToolGetter from "azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter";
import * as ngToolRunner from "azure-pipelines-tasks-packaging-common/nuget/NuGetToolRunner";
import * as nutil from "azure-pipelines-tasks-packaging-common/nuget/Utility";
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common/locationUtilities";

async function main(): Promise<void> {
    tl.setResult(tl.TaskResult.Failed, tl.loc("DeprecatedTask"));
}

main();
