import * as tl from "vsts-task-lib/task";
import nuGetGetter = require("nuget-task-common/NuGetToolGetter");

export function searchFiles(projectPattern: string | string[], basedir?: string): string[] {
    var projectFiles: string[];
    if (!!basedir) {
        projectFiles = tl.findMatch(basedir, projectPattern);
    } else {
        projectFiles = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), projectPattern);
    }
    
    if (!projectFiles || !projectFiles.length) {
        return [];
    }

    return projectFiles;
}

export async function getNuGetPath(): Promise<string> {
    tl.debug('Getting NuGet');
    return process.env[nuGetGetter.NUGET_EXE_TOOL_PATH_ENV_VAR] || await nuGetGetter.getNuGet("4.0.0");
}

export function getUtcDateString(): string {
    let now: Date = new Date();
    return `${now.getFullYear()}${now.getUTCMonth()}${now.getUTCDate()}-${now.getUTCHours()}${now.getUTCMinutes()}${now.getUTCSeconds()}`;
}
