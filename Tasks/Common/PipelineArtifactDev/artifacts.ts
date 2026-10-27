import * as fs from "node:fs/promises";
import * as path from "node:path";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";
import * as tl from "azure-pipelines-task-lib/task";
import { BuildArtifact, BuildResult } from "azure-devops-node-api/interfaces/BuildInterfaces";
import { ContainerItemType } from "azure-devops-node-api/interfaces/FileContainerInterfaces";
import { ArtifactService } from "./service";
import { ArtifactTool } from "./tool";
import { TaskRuntime, boolInput, positiveId, requiredVariable, resolveTaskPath, validateArtifactName, requireHosted, patternsFromInput, safeDestination, rejectSymlinks } from "./runtime";

export function parseProperties(value: string): Record<string, string> {
    if (!value.trim()) {
        return {};
    }
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Custom artifact properties must be a JSON object.");
    }
    const result: Record<string, string> = {};
    for (const [key, property] of Object.entries(parsed)) {
        if (!key.startsWith("user-") || typeof property !== "string") {
            throw new Error("Custom properties require user- prefixed keys and string values.");
        }
        result[key] = property;
    }
    return result;
}

export async function publishArtifacts(runtime: TaskRuntime, service: ArtifactService, tool: ArtifactTool, signal: AbortSignal): Promise<void> {
    requireHosted(runtime);
    const type = (runtime.input("artifactType") || "pipeline").toLowerCase();
    if (type !== "pipeline" && type !== "filepath") {
        throw new Error("Unrecognized artifact publish location.");
    }
    const properties = parseProperties(runtime.input("properties"));
    const project = requiredVariable(runtime, "System.TeamProjectId");
    const runId = positiveId(requiredVariable(runtime, "Build.BuildId"), "Build ID");
    const source = resolveTaskPath(runtime, runtime.input("path", true));
    const stat = await fs.stat(source);
    if (!stat.isFile() && !stat.isDirectory()) {
        throw new Error("The publish path must be a file or directory.");
    }
    const name = runtime.input("artifactName") || requiredVariable(runtime, "System.JobIdentifier")
        .replace(/[^a-zA-Z0-9 .-]/g, "").replace(/\.default/g, "");
    validateArtifactName(name);
    const jobId = requiredVariable(runtime, "System.JobId");
    signal.throwIfAborted();
    if (type === "filepath") {
        if (process.platform !== "win32") {
            throw new Error("Publishing to file shares is supported only on Windows.");
        }
        const share = resolveTaskPath(runtime, runtime.input("fileSharePath", true));
        const destination = safeDestination(share, name);
        let count = 1;
        if (boolInput(runtime, "parallel")) {
            const value = runtime.input("parallelCount") || "8";
            if (!/^-?\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
                throw new Error("parallelCount must be an integer.");
            }
            count = Math.min(128, Math.max(1, Number(value)));
            if (count !== Number(value)) {
                runtime.warning("parallelCount was clamped to the range 1-128.");
            }
        }
        await fs.mkdir(destination, { recursive: true });
        await service.associate(project, runId, {
            name, source: jobId,
            resource: { type: "filepath", data: share, properties: { artifactname: name, artifacttype: "filepath", artifactlocation: share } }
        });
        signal.throwIfAborted();
        await tool.copy(stat.isFile() ? path.dirname(source) : source, destination, count, stat.isFile() ? path.basename(source) : undefined);
        runtime.output("File-share artifact published.");
        return;
    }
    if (runtime.variable("System.HostType")?.toLowerCase() !== "build") {
        throw new Error("Pipeline artifacts can be published only from a build job.");
    }
    const args = ["pipelineartifact", "publish", "--project", project, "--pipeline-id", String(runId),
        "--artifact-name", name, "--path", source, "--job-id", jobId];
    const domain = runtime.variable("SEND_PIPELINE_ARTIFACTS_TO_BLOBSTORE_DOMAIN") ??
        process.env.SEND_PIPELINE_ARTIFACT_ARTIFACTS_TO_BLOBSTORE_DOMAIN;
    if (domain) {
        args.push("--domain-id", domain);
    }
    let temporary: string | undefined;
    try {
        if (Object.keys(properties).length > 0) {
            const tempRoot = requiredVariable(runtime, "Agent.TempDirectory");
            rejectSymlinks(tempRoot);
            temporary = await fs.mkdtemp(path.join(tempRoot, "pipeline-artifact-dev-"));
            const propertiesFile = path.join(temporary, "properties.json");
            await fs.writeFile(propertiesFile, JSON.stringify(properties), { mode: 0o600, flag: "wx" });
            args.push("--properties-file", propertiesFile);
        }
        await tool.run(args);
        runtime.output("Pipeline artifact published.");
    } finally {
        if (temporary) {
            await fs.rm(temporary, { recursive: true });
        }
    }
}

export function triggeringRun(runtime: TaskRuntime, definition: string): number | undefined {
    const host = runtime.variable("System.HostType")?.toLowerCase();
    const prefix = host && host !== "build" ?
        `Release.Artifacts.${runtime.variable("Release.TriggeringArtifact.Alias") ?? ""}` : "Build.TriggeredBy";
    if (runtime.variable(`${prefix}.DefinitionId`)?.toLowerCase() !== definition.toLowerCase()) {
        return undefined;
    }
    const id = runtime.variable(`${prefix}.BuildId`);
    return id ? positiveId(id, "Triggering build ID") : undefined;
}

export async function resolveRun(runtime: TaskRuntime, service: ArtifactService): Promise<{ project: string; runId: number }> {
    const source = runtime.input("source", true);
    if (source === "current") {
        return {
            project: requiredVariable(runtime, "System.TeamProjectId"),
            runId: positiveId(requiredVariable(runtime, "Build.BuildId"), "Build ID")
        };
    }
    if (source !== "specific") {
        throw new Error("Unrecognized artifact source.");
    }
    const project = await service.projectId(runtime.input("project", true));
    const definition = runtime.input("pipeline");
    if (boolInput(runtime, "preferTriggeringPipeline") && definition) {
        const id = triggeringRun(runtime, definition);
        if (id !== undefined) {
            return { project, runId: id };
        }
    }
    const version = runtime.input("runVersion", true);
    if (version === "specific") {
        return { project, runId: positiveId(runtime.input("runId", true), "Run ID") };
    }
    if (version !== "latest" && version !== "latestFromBranch") {
        throw new Error("Unrecognized run version.");
    }
    if (!definition) {
        throw new Error("A pipeline definition is required for latest run selection.");
    }
    let results = BuildResult.Succeeded;
    if (boolInput(runtime, "allowPartiallySucceededBuilds")) { results |= BuildResult.PartiallySucceeded; }
    if (boolInput(runtime, "allowFailedBuilds")) { results |= BuildResult.Failed; }
    if (boolInput(runtime, "allowCanceledBuilds")) { results |= BuildResult.Canceled; }
    return {
        project,
        runId: positiveId(String(await service.latestRun(project, {
            definition: await service.definitionId(project, definition),
            tags: runtime.input("tags").split(","),
            results,
            branch: version === "latestFromBranch" ? runtime.input("runBranch", true) : undefined
        })), "Selected run ID")
    };
}

function resource(artifact: BuildArtifact): { name: string; type: string; data: string } {
    if (!artifact.name || !artifact.resource?.type || !artifact.resource.data) {
        throw new Error("Artifact service returned incomplete artifact metadata.");
    }
    validateArtifactName(artifact.name);
    return { name: artifact.name, type: artifact.resource.type.toLowerCase(), data: artifact.resource.data };
}

function matching(paths: string[], patterns: string[]): Set<string> {
    return new Set(tl.match(paths, patterns, undefined, {
        dot: true, nobrace: true, nocase: false, nocomment: false, nonegate: false, flipNegate: false
    }));
}

export function parseContainer(data: string): { id: number; root: string } {
    const parsed = /^#\/(\d+)\/(.+)$/.exec(data);
    if (!parsed) {
        throw new Error("Invalid container artifact resource data.");
    }
    return { id: positiveId(parsed[1], "Container ID"), root: parsed[2] };
}

async function writeDownloadedFile(destination: string, signal: AbortSignal, write: (file: string) => Promise<void>): Promise<void> {
    signal.throwIfAborted();
    rejectSymlinks(destination);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    const temporary = await fs.mkdtemp(path.join(path.dirname(destination), ".artifact-dev-"));
    try {
        const file = path.join(temporary, "content");
        await write(file);
        signal.throwIfAborted();
        rejectSymlinks(destination);
        await fs.rename(file, destination);
    } finally {
        await fs.rm(temporary, { recursive: true });
    }
}

async function downloadContainer(
    artifact: BuildArtifact, project: string, target: string, multiple: boolean,
    patterns: string[], service: ArtifactService, signal: AbortSignal
): Promise<void> {
    const info = resource(artifact);
    const container = parseContainer(info.data);
    const items = await service.containerItems(container.id, project, container.root);
    const root = multiple ? safeDestination(target, info.name) : target;
    const files = items.filter(item => item.itemType === ContainerItemType.File);
    const plans = files.map(item => {
        if (!item.path || !item.path.startsWith(`${container.root}/`)) {
            throw new Error("Container item lies outside the artifact root.");
        }
        return { item: item.path, destination: safeDestination(root, item.path.slice(container.root.length + 1)) };
    });
    const matched = matching(plans.map(plan => plan.item), patterns);
    for (const plan of plans.filter(plan => matched.has(plan.item))) {
        await writeDownloadedFile(plan.destination, signal, async file => {
            const stream = await service.containerFile(container.id, project, plan.item);
            await pipeline(stream, createWriteStream(file, { flags: "wx" }), { signal });
        });
    }
}

async function downloadFileShare(artifact: BuildArtifact, target: string, patterns: string[], signal: AbortSignal): Promise<void> {
    if (process.platform !== "win32") {
        throw new Error("File-share artifact downloads require Windows in this development task.");
    }
    const info = resource(artifact);
    const source = safeDestination(info.data, info.name);
    const root = safeDestination(target, info.name);
    const files = tl.find(source, { followSpecifiedSymbolicLink: false, followSymbolicLinks: false, allowBrokenSymbolicLinks: false });
    const plans: { source: string; item: string; destination: string }[] = [];
    for (const file of files) {
        const stat = await fs.lstat(file);
        if (stat.isSymbolicLink()) {
            throw new Error("File-share artifacts containing symbolic links are not supported.");
        }
        if (stat.isFile()) {
            const relative = path.relative(source, file);
            plans.push({ source: file, item: `${info.name}/${relative.split(path.sep).join("/")}`, destination: safeDestination(root, relative) });
        }
    }
    const matched = matching(plans.map(plan => plan.item), patterns);
    for (const plan of plans.filter(plan => matched.has(plan.item))) {
        await writeDownloadedFile(plan.destination, signal, file => fs.copyFile(plan.source, file));
    }
}

export async function downloadArtifacts(runtime: TaskRuntime, service: ArtifactService, tool: ArtifactTool, signal: AbortSignal): Promise<void> {
    requireHosted(runtime);
    const name = runtime.input("artifact");
    if (name) { validateArtifactName(name); }
    const target = resolveTaskPath(runtime, runtime.input("path", true));
    rejectSymlinks(target);
    const run = await resolveRun(runtime, service);
    runtime.setVariable("BuildNumber", String(run.runId));
    const artifacts = await service.artifacts(run.project, run.runId, name || undefined);
    const infos = artifacts.map(resource);
    const supported = new Set(["pipelineartifact", "container", "filepath"]);
    for (const info of infos) {
        if (!supported.has(info.type)) {
            throw new Error(`Unsupported artifact resource type ${info.type}. No transfer was started.`);
        }
        if (info.type === "filepath" && process.platform !== "win32") {
            throw new Error("File-share artifact downloads require Windows. No transfer was started.");
        }
        if (info.type === "container") { parseContainer(info.data); }
    }
    signal.throwIfAborted();
    await fs.mkdir(target, { recursive: true });
    const patterns = patternsFromInput(runtime.input("patterns"));
    if (infos.some(info => info.type === "pipelineartifact")) {
        const args = ["pipelineartifact", "download", "--project", run.project, "--pipeline-id", String(run.runId), "--path", target];
        if (name) { args.push("--artifact-name", name); }
        for (const pattern of patterns) { args.push("--pattern", pattern); }
        await tool.run(args);
    }
    for (let index = 0; index < artifacts.length; index++) {
        signal.throwIfAborted();
        if (infos[index].type === "container") {
            await downloadContainer(artifacts[index], run.project, target, !name, patterns, service, signal);
        } else if (infos[index].type === "filepath") {
            await downloadFileShare(artifacts[index], target, patterns, signal);
        }
    }
    runtime.setVariable("DownloadPipelineArtifactResourceTypes", [...new Set(infos.map(info =>
        info.type === "pipelineartifact" ? "PipelineArtifact" : info.type === "container" ? "Container" : "filepath"))].join(","));
    runtime.output(artifacts.length ? "Artifacts downloaded." : "No artifacts are associated with the selected run.");
}
