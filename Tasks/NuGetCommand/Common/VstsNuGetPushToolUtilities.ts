// Placed as a separate file for the purpose of unit testing

import * as util from "./utilities";
import * as path from "path";

export function getBundledVstsNuGetPushLocation(): string {
    const vstsNuGetPushPaths: string[] = ["VstsNuGetPush/0.13.0"];

    const toolPath = util.locateTool("VstsNuGetPush", 
    <util.LocateOptions>{
        root: path.dirname(__dirname),
        searchPath: vstsNuGetPushPaths,
        toolFilenames: ["VstsNuGetPush.exe"],
    });

    return toolPath;
}