import { TaskInputs } from "./inputs";

/**
 * Agent settings (knobs and pipeline variables) that the PipelineArtifact agent plug-ins honored, and their mapping
 * to ArtifactTool options. Pipeline variables and agent environment variables both reach the task as variables.
 */

/** Enables the chunk size from the service's client settings (and its override) for pipeline artifacts. */
export const LargeChunkSizeVariable = "AGENT_ENABLE_PIPELINEARTIFACT_LARGE_CHUNK_SIZE";

/** Overrides the chunk size for pipeline artifacts when large chunk sizes are enabled. */
export const ChunkSizeOverrideVariable = "OVERRIDE_PIPELINE_ARTIFACT_CHUNKSIZE";

/** Overrides the BlobStore domain pipeline artifacts are published to: the pipeline variable, then the agent environment variable. */
export const PublishDomainVariables = ["SEND_PIPELINE_ARTIFACTS_TO_BLOBSTORE_DOMAIN", "SEND_PIPELINE_ARTIFACT_ARTIFACTS_TO_BLOBSTORE_DOMAIN"];

/** Overrides the dedup client's maximum parallelism. */
export const DedupParallelismVariable = "AZURE_PIPELINES_DEDUP_PARALLELISM";

/** The ArtifactTool environment variable that sets the dedup client's maximum parallelism. */
export const ArtifactToolMaxParallelismEnvironment = "VSO_ARTIFACT_TOOL_HTTP_CLIENT_MAX_PARALLELISM";

/** The serialized default chunk hash type (Dedup64K), which the agent used unless large chunk sizes were enabled. */
export const DefaultChunkHashType = "DEDUPNODEORCHUNK";

/** The serialized chunk hash types the agent accepted as a chunk size override. */
const ChunkHashTypes = [DefaultChunkHashType, "DEDUP1024K"];

/**
 * Reads a boolean agent setting the way the agent does: "1", "true", and "$true" (any case) are true.
 */
export function isAgentKnobTrue(value: string | undefined): boolean {
    return ["1", "true", "$true"].includes((value ?? "").toLowerCase());
}

/**
 * Selects the chunk hash type as the agent did. Unless large chunk sizes are enabled, the default is used. When they
 * are enabled, a valid override is used; otherwise the chunk size from the service's client settings is used, which
 * ArtifactTool applies when no hash type is passed.
 */
export function chunkHashTypeArgs(task: TaskInputs, log: (message: string) => void): string[] {
    if (!isAgentKnobTrue(task.variable(LargeChunkSizeVariable))) {
        return ["--hash-type", DefaultChunkHashType];
    }

    const override = task.variable(ChunkSizeOverrideVariable);
    if (override) {
        if (ChunkHashTypes.includes(override.toUpperCase())) {
            log(`Overriding chunk size to '${override}'.`);
            return ["--hash-type", override];
        }
        log(`Override chunk size '${override}' is not a valid chunk type. Falling back to client settings.`);
    }
    return [];
}

/** Selects the publish domain override, when set, as the agent did: the first non-empty source wins. */
export function publishDomainArgs(task: TaskInputs): string[] {
    const domain = PublishDomainVariables.map(name => task.variable(name)).find(value => !!value);
    return domain?.trim() ? ["--domain-id", domain] : [];
}

/**
 * Passes the dedup parallelism override to ArtifactTool when it is an integer, as the agent's int.TryParse accepted.
 */
export function dedupParallelismEnvironment(task: TaskInputs): Record<string, string> {
    const value = task.variable(DedupParallelismVariable);
    if (value && /^\s*[+-]?\d+\s*$/.test(value)) {
        const parallelism = Number(value.trim());
        if (parallelism >= -2147483648 && parallelism <= 2147483647) {
            return { [ArtifactToolMaxParallelismEnvironment]: String(parallelism) };
        }
    }
    return {};
}
