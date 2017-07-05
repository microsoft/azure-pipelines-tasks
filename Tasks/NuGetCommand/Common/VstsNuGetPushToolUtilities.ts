// Placed as a separate file for the purpose of unit testing
import * as path from "path";
import * as commandHelper from "nuget-task-common/CommandHelper";

export function getBundledVstsNuGetPushLocation(): string {
    const vstsNuGetPushPaths: string[] = ["VstsNuGetPush/0.13.0"];

    const toolPath = commandHelper.locateTool("VstsNuGetPush",
    <commandHelper.LocateOptions>{
        root: path.dirname(__dirname),
        searchPath: vstsNuGetPushPaths,
        toolFilenames: ["VstsNuGetPush.exe"],
    });

    return toolPath;
}