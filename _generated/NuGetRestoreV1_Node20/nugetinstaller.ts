import * as path from "path";
import * as Q  from "q";
import * as tl from "azure-pipelines-task-lib/task";
import {IExecOptions} from "azure-pipelines-task-lib/toolrunner";

import * as auth from "azure-pipelines-tasks-packaging-common/nuget/Authentication";
import INuGetCommandOptions from "azure-pipelines-tasks-packaging-common/nuget/INuGetCommandOptions";
import {IPackageSource, NuGetConfigHelper} from "azure-pipelines-tasks-packaging-common/nuget/NuGetConfigHelper";
import nuGetGetter = require("azure-pipelines-tasks-packaging-common/nuget/NuGetToolGetter");
import * as ngToolRunner from "azure-pipelines-tasks-packaging-common/nuget/NuGetToolRunner";
import * as nutil from "azure-pipelines-tasks-packaging-common/nuget/Utility";
import peParser = require('azure-pipelines-tasks-packaging-common/pe-parser/index');
import {VersionInfo} from "azure-pipelines-tasks-packaging-common/pe-parser/VersionResource";
import * as pkgLocationUtils from "azure-pipelines-tasks-packaging-common/locationUtilities";
import { getProjectAndFeedIdFromInputParam } from "azure-pipelines-tasks-packaging-common/util";
import * as telemetry from "azure-pipelines-tasks-utility-common/telemetry";

const NUGET_ORG_V2_URL: string = "https://www.nuget.org/api/v2/";
const NUGET_ORG_V3_URL: string = "https://api.nuget.org/v3/index.json";

async function main(): Promise<void> {
    tl.setResult(tl.TaskResult.Failed, tl.loc("DeprecatedTask"));
}

main();
