// Placed as a separate file for the purpose of unit testing
import * as commandHelper from "nuget-task-common/CommandHelper";
import * as path from "path";

export function getBundledVstsNuGetPushLocation(): string {
    const vstsNuGetPushPaths: string[] = ['VstsNuGetPush/0.17.0'];

    const toolPath = commandHelper.locateTool('VstsNuGetPush', <commandHelper.LocateOptions>{
        root: path.dirname(__dirname),
        searchPath: vstsNuGetPushPaths,
        toolFilenames: ['VstsNuGetPush.exe']
    });

    return toolPath;
}
