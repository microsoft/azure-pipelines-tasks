import * as tl from "azure-pipelines-task-lib/task";

export function getProjectFiles(projectPattern: string[], cwd: string): string[] {
    if (projectPattern.length == 0) {
        return [""];
    }
    var projectFiles: string[] = tl.findMatch(tl.getVariable("System.DefaultWorkingDirectory") || cwd, projectPattern);

    if (!projectFiles || !projectFiles.length) {
        return [];
    }

    return projectFiles;
}
