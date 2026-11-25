import * as path from "node:path";
import * as fs from "node:fs";
import * as tl from "azure-pipelines-task-lib/task";

export interface TaskRuntime {
    input(name: string, required?: boolean): string;
    variable(name: string): string | undefined;
    setVariable(name: string, value: string): void;
    warning(message: string): void;
    output(message: string): void;
}

export const taskRuntime: TaskRuntime = {
    input: (name, required = false) => tl.getInput(name, required) ?? "",
    variable: name => tl.getVariable(name),
    setVariable: (name, value) => tl.setVariable(name, value),
    warning: message => tl.warning(message),
    output: message => console.log(`artifact task: ${message.replace(/[\r\n]/g, " ")}`)
};

export function requiredVariable(runtime: TaskRuntime, name: string): string {
    const value = runtime.variable(name);
    if (!value) {
        throw new Error(`Required pipeline variable ${name} is missing.`);
    }
    return value;
}

export function positiveId(value: string, label: string): number {
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 2147483647) {
        throw new Error(`${label} must be a positive 32-bit integer.`);
    }
    return Number(value);
}

export function boolInput(runtime: TaskRuntime, name: string): boolean {
    const value = runtime.input(name).toLowerCase();
    if (value && value !== "true" && value !== "false") {
        throw new Error(`${name} must be true or false.`);
    }
    return value === "true";
}

export function resolveTaskPath(runtime: TaskRuntime, value: string): string {
    if (!value) {
        throw new Error("Artifact path cannot be empty.");
    }
    return path.isAbsolute(value) ? path.normalize(value) :
        path.resolve(requiredVariable(runtime, "System.DefaultWorkingDirectory"), value);
}

export function validateArtifactName(name: string): void {
    if (!name || /^[. ]+$/.test(name) || /[\x00-\x1f\x7f"<>:|*?\\/]/.test(name)) {
        throw new Error("Invalid artifact name: names cannot contain path separators, control characters, reserved punctuation, or only dots/spaces.");
    }
}

export function requireHosted(runtime: TaskRuntime): void {
    if (runtime.variable("System.ServerType")?.toLowerCase() !== "hosted") {
        throw new Error("Pipeline artifact development tasks are not supported on Azure DevOps Server.");
    }
}

export function patternsFromInput(value: string): string[] {
    return (value || "**").split(/\r?\n/).filter(pattern => pattern.length > 0);
}

export function safeDestination(root: string, relative: string): string {
    const parts = relative.replace(/\\/g, "/").split("/");
    if (!relative || path.posix.isAbsolute(relative) || path.win32.isAbsolute(relative) ||
        parts.some(part => !part || part === "." || part === ".." || /[\x00-\x1f<>:"|?*]/.test(part) ||
            /[. ]$/.test(part) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) {
        throw new Error("Artifact item has an unsafe destination path.");
    }
    const destination = path.resolve(root, ...parts);
    rejectSymlinks(destination);
    return destination;
}

export function rejectSymlinks(destination: string): void {
    let current = path.resolve(destination);
    while (true) {
        try {
            if (fs.lstatSync(current).isSymbolicLink()) {
                throw new Error("Artifact paths must not traverse symbolic links or junctions.");
            }
        } catch (error) {
            if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
                throw error;
            }
        }
        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }
        current = parent;
    }
}
