import * as tl from "vsts-task-lib/task";
import * as nuGetGetter from "nuget-task-common/NuGetToolGetter";

export function getProjectFiles(projectPattern: string[]): string[] {
    if (projectPattern.length == 0) {
        return [""];
    }

    var projectFiles = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), projectPattern);
    if (!projectFiles || !projectFiles.length) {
        tl.warning(tl.loc("noProjectFilesFound"));
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
