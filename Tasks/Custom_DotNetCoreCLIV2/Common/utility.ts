import * as tl from "azure-pipelines-task-lib/task";

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

export function getRequestTimeout(): number {
    let timeout = 60_000 * 5;
    const inputValue: string = tl.getInput('requestTimeout', false);
    if (!(Number.isNaN(Number(inputValue)))) {
        const maxTimeout = 60_000 * 10;
        timeout = Math.min(parseInt(inputValue), maxTimeout);
    }
    return timeout;
}
