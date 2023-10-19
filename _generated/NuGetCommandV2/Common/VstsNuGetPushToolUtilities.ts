// Placed as a separate file for the purpose of unit testing
import * as path from "path";
import * as commandHelper from "azure-pipelines-tasks-packaging-common/nuget/CommandHelper";

export function getBundledVstsNuGetPushLocation(): string {
    const vstsNuGetPushPaths: string[] = ["VstsNuGetPush/0.19.0/tools"];

    const toolPath = commandHelper.locateTool("VstsNuGetPush",
    <commandHelper.LocateOptions>{
        root: path.dirname(__dirname),
        searchPath: vstsNuGetPushPaths,
        toolFilenames: ["VstsNuGetPush.exe"],
    });

    return toolPath;
}