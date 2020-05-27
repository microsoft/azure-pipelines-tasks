import * as tl from "azure-pipelines-task-lib/task";

export function getProjectFiles(projectPattern: string[], cwd: string|null = null): string[] {
    if (projectPattern.length == 0) {
        return [""];
    }
    var projectFiles: string[] = tl.findMatch(cwd || tl.getVariable("System.DefaultWorkingDirectory"), projectPattern);

    if (!projectFiles || !projectFiles.length) {
        return [];
    }

    return projectFiles;
}
