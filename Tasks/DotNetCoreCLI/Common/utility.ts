import * as tl from "vsts-task-lib/task";

export function getProjectFiles(projectPattern: string[]): string[] {
    if (projectPattern.length == 0) {
        return [""];
    }
    var projectFiles: string[] = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || process.cwd(), projectPattern);

    if (!projectFiles || !projectFiles.length) {
        return [];
    }

    return projectFiles;
}
