export interface ToolResult {
    status: "Succeeded" | "Failed" | "Cancelled";
    exitCode: number;
    message?: string;
    outputs: Record<string, string>;
}

/**
 * Parses the ArtifactTool result file. Only declared output names are accepted, so the tool cannot set
 * arbitrary pipeline variables.
 */
export function parseResult(text: string, allowedOutputs: readonly string[]): ToolResult {
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("The ArtifactTool result file is not a JSON object.");
    }

    const value = parsed as Record<string, unknown>;
    if (value.status !== "Succeeded" && value.status !== "Failed" && value.status !== "Cancelled") {
        throw new Error("The ArtifactTool result file has an unknown status.");
    }

    const outputs: Record<string, string> = {};
    const rawOutputs = value.outputs;
    if (rawOutputs && typeof rawOutputs === "object" && !Array.isArray(rawOutputs)) {
        for (const [name, output] of Object.entries(rawOutputs as Record<string, unknown>)) {
            if (allowedOutputs.includes(name) && typeof output === "string") {
                outputs[name] = output;
            }
        }
    }

    return {
        status: value.status,
        exitCode: typeof value.exitCode === "number" ? value.exitCode : -1,
        message: typeof value.message === "string" ? value.message : undefined,
        outputs
    };
}
