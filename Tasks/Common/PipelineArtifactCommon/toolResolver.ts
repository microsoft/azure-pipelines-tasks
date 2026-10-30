import * as path from "node:path";

/** Pipeline variable naming a directory that contains a locally built ArtifactTool executable. */
export const OverrideVariable = "PipelineArtifact.OverrideArtifactToolPath";

/** BlobStore resource area that hosts the client tool download API. */
export const BlobStoreAreaId = "5294ef93-12a1-4d13-8671-9d9d014072c8";

export interface ToolPlatform {
    osName: "Windows" | "Linux" | "Darwin";
    arch: "amd64" | "arm64";
    distroName?: string;
}

export interface ToolResolverDeps {
    variable(name: string): string | undefined;
    platform: NodeJS.Platform;
    arch: string;
    exists(file: string): boolean;
    readOsRelease(): string | undefined;
    fetchJson(url: string): Promise<unknown>;
    downloadFile(url: string): Promise<string>;
    extractZip(file: string, destination: string): Promise<void>;
    makeExecutable(file: string): void;
    rename(from: string, to: string): void;
    removeDirectory(directory: string): void;
    tempDirectory(): string;
    uniqueName(): string;
    debug(message: string): void;
}

export function executableName(platform: NodeJS.Platform): string {
    return platform === "win32" ? "ArtifactTool.exe" : "artifacttool";
}

/**
 * Maps the task's actual execution platform (which may be a container) to the client tool API's
 * platform parameters. Platforms without an ArtifactTool build fail explicitly.
 */
export function toolPlatform(platform: NodeJS.Platform, arch: string, osRelease: string | undefined): ToolPlatform {
    const osName = platform === "win32" ? "Windows" : platform === "linux" ? "Linux" : platform === "darwin" ? "Darwin" : undefined;
    const toolArch = arch === "x64" ? "amd64" : arch === "arm64" ? "arm64" : undefined;
    if (!osName || !toolArch) {
        throw new Error(`ArtifactTool is not available for ${platform}-${arch}. Use the previous major version of this task on this agent.`);
    }

    if (osName !== "Linux") {
        return { osName, arch: toolArch };
    }

    const distroId = /^ID="?([^"\r\n]*)"?/m.exec(osRelease ?? "")?.[1]?.toLowerCase();
    if (distroId === "alpine") {
        if (toolArch !== "amd64") {
            throw new Error(`ArtifactTool is not available for Alpine Linux on ${arch}. Use the previous major version of this task on this agent.`);
        }
        return { osName, arch: toolArch, distroName: "Alpine" };
    }

    return { osName, arch: toolArch };
}

export function downloadUrl(blobStoreUrl: string, target: ToolPlatform): string {
    const base = blobStoreUrl.endsWith("/") ? blobStoreUrl : `${blobStoreUrl}/`;
    const query = new URLSearchParams({ "api-version": "5.0-preview.1", osName: target.osName, arch: target.arch });
    if (target.distroName) {
        query.set("distroName", target.distroName);
    }
    return `${base}_apis/clienttools/artifacttool/download?${query.toString()}`;
}

export function resourceAreaUrl(collectionUrl: string): string {
    const base = collectionUrl.endsWith("/") ? collectionUrl : `${collectionUrl}/`;
    return `${base}_apis/resourceAreas/${BlobStoreAreaId}?api-version=5.0-preview.1`;
}

/**
 * The fixed directory ArtifactTool is cached in for the job, for example
 * <Agent.TempDirectory>/ArtifactTool/Windows-amd64. The agent empties Agent.TempDirectory before every job,
 * so the tool is downloaded once per job and always current. The path does not depend on any pipeline
 * variable other than the agent's own temp directory, so policies can rely on it.
 */
export function toolDirectory(tempDirectory: string, target: ToolPlatform): string {
    return path.join(tempDirectory, "ArtifactTool", [target.osName, target.arch, target.distroName].filter(Boolean).join("-"));
}

/**
 * Resolves the ArtifactTool executable: a local override directory, the job cache directory, or an
 * anonymous download from the client tool API into the job cache directory. No credential is sent when
 * locating or downloading the tool.
 */
export async function resolveArtifactTool(deps: ToolResolverDeps, collectionUrl: string): Promise<string> {
    const executable = executableName(deps.platform);

    const overrideDirectory = deps.variable(OverrideVariable);
    if (overrideDirectory) {
        const overridePath = path.join(overrideDirectory, executable);
        if (!path.isAbsolute(overrideDirectory) || !deps.exists(overridePath)) {
            throw new Error(`${OverrideVariable} must be an absolute directory containing ${executable}; '${overridePath}' was not found.`);
        }
        deps.debug(`Using ArtifactTool from ${OverrideVariable}: ${overridePath}`);
        return overridePath;
    }

    const target = toolPlatform(deps.platform, deps.arch, deps.platform === "linux" ? deps.readOsRelease() : undefined);
    const directory = toolDirectory(deps.tempDirectory(), target);
    const cached = path.join(directory, executable);
    if (deps.exists(cached)) {
        deps.debug(`Reusing ArtifactTool downloaded earlier in this job: ${cached}`);
        return cached;
    }

    const area = await deps.fetchJson(resourceAreaUrl(collectionUrl)) as { locationUrl?: unknown } | undefined;
    if (!area || typeof area.locationUrl !== "string" || !area.locationUrl) {
        throw new Error("Unable to locate the Azure Artifacts client tool service for this organization.");
    }

    const url = downloadUrl(area.locationUrl, target);
    deps.debug(`Downloading ArtifactTool from ${url}`);
    const archive = await deps.downloadFile(url);

    // Extract beside the cache directory and move it into place only when complete, so a partial
    // extraction is never reused.
    const staging = `${directory}.${deps.uniqueName()}`;
    await deps.extractZip(archive, staging);
    const staged = path.join(staging, executable);
    if (!deps.exists(staged)) {
        deps.removeDirectory(staging);
        throw new Error(`The downloaded ArtifactTool package does not contain ${executable}.`);
    }

    if (deps.platform !== "win32") {
        deps.makeExecutable(staged);
    }

    deps.removeDirectory(directory);
    deps.rename(staging, directory);
    return cached;
}
