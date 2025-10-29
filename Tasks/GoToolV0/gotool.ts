import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as tl from 'azure-pipelines-task-lib/task';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry';
import * as fs from 'fs';

const osPlat = os.platform();
const osArch = os.arch();

async function run() {
    try {
        const rawVersion = tl.getInput('version', true);
        if (!rawVersion || ['null','undefined',''].includes(rawVersion.trim().toLowerCase())) {
            throw new Error("Input 'version' is required and must not be empty, 'null' or 'undefined'.");
        }
        const version = rawVersion.trim();
        
        const downloadUrl = resolveDownloadUrl();
        const resolvedVersion = await getGo(version, downloadUrl);
        telemetry.emitTelemetry('TaskHub', 'GoToolV0', { version: resolvedVersion, customBaseUrl: String(!!downloadUrl) });
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

async function getGo(version: string, baseUrl?: string): Promise<string> {
    const resolved = await resolveVersionAndCache(version, baseUrl);
    tl.debug(`resolveVersionAndCache result filenameVersion=${resolved.filenameVersion} cacheVersion=${resolved.cacheVersion ?? '<?>'} toolName=${resolved.toolName} (type=${typeof resolved.cacheVersion})`);
    let toolPath: string | null = null;

    if (resolved.cacheVersion) {
        toolPath = toolLib.findLocalTool(resolved.toolName, resolved.cacheVersion);
    }

    if (!toolPath) {
        toolPath = await acquireGo(resolved.filenameVersion, baseUrl, resolved.cacheVersion, resolved.toolName);
        tl.debug("Go tool is available under " + toolPath);
    }

    setGoEnvironmentVariables(toolPath);
    const binPath = path.join(toolPath, 'bin');
    toolLib.prependPath(binPath);
    return resolved.filenameVersion;
}

async function acquireGo(filenameVersion: string, baseUrl?: string, cacheVersion?: string, toolName = 'go'): Promise<string> {
    const fileName = getFileName(filenameVersion);
    const downloadUrl = getDownloadUrl(fileName, baseUrl);
    tl.debug(`Resolved Go download URL: ${downloadUrl}`);
    console.log(`Downloading Go from ${downloadUrl}`);
    let downloadPath: string | null = null;
    try {
        downloadPath = await toolLib.downloadTool(downloadUrl);
    } catch (error) {
        tl.debug(error);
        throw new Error(`Failed to download version ${filenameVersion}. Please verify that the version is valid and resolve any other issues. ${error}`);
    }

    tl.assertAgent('2.115.0');

    let extPath = tl.getVariable('Agent.TempDirectory');
    if (!extPath) {
        throw new Error("Expected Agent.TempDirectory to be set");
    }

    if (osPlat === 'win32') {
        extPath = await toolLib.extractZip(downloadPath);
    } else {
        extPath = await toolLib.extractTar(downloadPath);
    }

    const toolRoot = path.join(extPath, "go");
    if (cacheVersion) {
        tl.debug(`Invoking cacheDir with tool='${toolName}' cacheVersion='${cacheVersion}' (type=${typeof cacheVersion})`);
        return await toolLib.cacheDir(toolRoot, toolName, cacheVersion);
    } else {
        tl.debug(`Skipping cacheDir because cacheVersion='${cacheVersion}'`);
    }
    return toolRoot;
}

function getFileName(version: string): string {
    const platform = osPlat === "win32" ? "windows" : osPlat;
    let arch: string;
    if (osArch === "x64") {
        arch = "amd64";
    } else if (osArch === "arm64") {
        arch = "arm64";
    } else {
        arch = "386";
    }
    const ext = osPlat === "win32" ? "zip" : "tar.gz";
    return util.format("go%s.%s-%s.%s", version, platform, arch, ext);
}

function getDownloadUrl(filename: string, baseUrl?: string): string {
    const base = (baseUrl?.trim()) || "https://go.dev/dl";
    return `${base.replace(/\/+$/, '')}/${filename}`;
}

function setGoEnvironmentVariables(goRoot: string): void {
    tl.setVariable('GOROOT', goRoot);
    const goPath = tl.getInput("goPath", false);
    const goBin = tl.getInput("goBin", false);
    if (goPath) {
        tl.setVariable("GOPATH", goPath);
    }
    if (goBin) {
        tl.setVariable("GOBIN", goBin);
    }
}

type GoBaseChannel = 'official' |  'microsoft' | 'unsupported';

function classifyBaseUrl(baseUrl?: string): { type: GoBaseChannel; normalized?: string } {
    if (!baseUrl || !baseUrl.trim()) return { type: 'official' };
    const raw = baseUrl.trim();
    try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase();
        const p = u.pathname.replace(/\/+$/, '').toLowerCase();
        if (host === 'go.dev' && p === '/dl') {
            return { type: 'official', normalized: raw };
        }
        if (host === 'aka.ms' && p === '/golang/release/latest') {
            return { type:  'microsoft', normalized: raw };
        }
        return { type: 'unsupported', normalized: raw };
    } catch {
        return { type: 'unsupported' };
    }
}

class ParsedGoVersion {
    major: number;
    minor: number;
    patch?: number;
    revision?: number;
    original: string;
    
    constructor(major: number, minor: number, patch?: number, revision?: number, original?: string) {
        if (revision !== undefined && patch === undefined) {
            throw new Error(`Invalid version format: revision requires patch version (e.g., ${major}.${minor}.0-${revision} instead of ${major}.${minor}-${revision})`);
        }
        this.major = major;
        this.minor = minor;
        this.patch = patch;
        this.revision = revision;
        this.original = original || '';
    }
    
    // Helper methods for clear version classification
    hasMajorMinorPatchOnly(): boolean {
        return this.patch !== undefined && this.revision === undefined;
    }
    
    hasMajorMinorPatchRevision(): boolean {
        return this.revision !== undefined;
    }
    
    hasMajorMinorOnly(): boolean {
        return this.patch === undefined && this.revision === undefined;
    }
    
    toString(): string {
        let result = `${this.major}.${this.minor}`;
        if (this.patch !== undefined) {
            result += `.${this.patch}`;
        }
        if (this.revision !== undefined) {
            result += `-${this.revision}`;
        }
        return result;
    }
}

function parseGoVersion(input: string): ParsedGoVersion {
    const normalized = input.replace(/^go/i, '').replace(/^v/i, '').trim();
    // Parse: major.minor[.patch][-revision]
    const m = /^(\d+)\.(\d+)(?:\.(\d+))?(?:-(\d+))?$/.exec(normalized);
    if (!m) {
        throw new Error(`Invalid version format: ${input}`);
    }
    
    return new ParsedGoVersion(
        parseInt(m[1], 10),
        parseInt(m[2], 10),
        m[3] ? parseInt(m[3], 10) : undefined,
        m[4] ? parseInt(m[4], 10) : undefined,
        normalized
    );
}

async function getLatestPatchFromGoDev(parsed: ParsedGoVersion): Promise<string> {
    const { major, minor } = parsed;

    const metadataUrl = 'https://go.dev/dl/?mode=json&include=all';
    let jsonPath: string;
    try {
        tl.debug(`Downloading Go releases metadata from ${metadataUrl}`);
        jsonPath = await toolLib.downloadTool(metadataUrl);
    } catch (error) {
        throw new Error(`Failed to download Go releases metadata: ${error instanceof Error ? error.message : String(error)}`);
    }
    const raw = fs.readFileSync(jsonPath, 'utf8');

    interface GoRelease {
        version?: string;
        stable?: boolean;
    }

    let releases: GoRelease[];
    try {
        releases = JSON.parse(raw);
    } catch {
        throw new Error('Failed to parse Go releases metadata from go.dev');
    }

    let maxPatch = -1;
    for (const rel of releases) {
        if (!rel?.version || rel.stable !== true) continue;
        const m = /^go(\d+)\.(\d+)(?:\.(\d+))?$/i.exec(rel.version);
        if (!m) continue;
        const maj = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const pat = m[3] ? parseInt(m[3], 10) : 0;
        if (maj === major && min === minor) {
            if (pat > maxPatch) maxPatch = pat;
        }
    }

    if (maxPatch < 0) {
        throw new Error(`Could not find a stable patch version for ${major}.${minor} from go.dev`);
    }
    return `${major}.${minor}.${maxPatch}`;
}


async function getMicrosoftLatestFromManifest(parsed: ParsedGoVersion): Promise<string> {
    const { major, minor, patch } = parsed;
    let manifestId = `${major}.${minor}`;
    if (typeof patch === 'number') {
        manifestId = `${major}.${minor}.${patch}`;
    }
    const manifestUrl = `https://aka.ms/golang/release/latest/go${manifestId}.assets.json`;
    tl.debug(`Downloading Microsoft build of Go manifest from ${manifestUrl}`);
    let jsonPath: string;
    try {
        jsonPath = await toolLib.downloadTool(manifestUrl);
    } catch (e) {
        throw new Error(`Failed to download Microsoft Go manifest for ${manifestId}: ${e instanceof Error ? e.message : String(e)}`);
    }
    const raw = fs.readFileSync(jsonPath, 'utf8');

    interface MicrosoftManifest {
        version?: string;
    }

    let manifestData: MicrosoftManifest;
    try {
        manifestData = JSON.parse(raw);
    } catch {
        throw new Error('Failed to parse Microsoft Go manifest JSON');
    }
    if (!manifestData?.version) {
        throw new Error('Microsoft manifest missing top-level version');
    }
    const ver = manifestData.version.trim();
    const m = /^(?:go)?(\d+\.\d+\.\d+(?:-\d+)?)$/i.exec(ver);
    if (!m) {
        throw new Error(`Unexpected version format in Microsoft manifest: ${ver}`);
    }
    return m[1];
}

async function resolveVersionAndCache(version: string, baseUrl?: string): Promise<{ filenameVersion: string, cacheVersion?: string, toolName: string }> {
    const v = version.trim().replace(/^v/i, '');
    if (!v) {
        throw new Error("Version input resolved to empty string.");
    }
    
    // Parse version once for clear classification
    const parsed = parseGoVersion(v);
    
    const channel = classifyBaseUrl(baseUrl);
    const isOfficial = channel.type === 'official';
    const isMicrosoft = channel.type === 'microsoft';
    // Cache differentiation: use distinct toolName values ('go' vs 'go-aka') so cacheVersion can remain a pure semver.
    // cacheVersion MUST be a valid semver string accepted by tool-lib; adding prefixes caused null normalization and failures.

    if (isOfficial) {
        // Official Go: only accepts major.minor or major.minor.patch (no revision)
        if (parsed.hasMajorMinorPatchRevision()) {
            throw new Error("Official Go version must be 'major.minor' (e.g. 1.22) or 'major.minor.patch' (e.g. 1.22.3).");
        }
        
        if (parsed.hasMajorMinorPatchOnly()) {
            // Full patch version specified - use as-is
            return { filenameVersion: v, cacheVersion: v, toolName: 'go' };
        }
        
        if (parsed.hasMajorMinorOnly()) {
            // Resolve to latest patch
            try {
                const resolved = await getLatestPatchFromGoDev(parsed);
                return { filenameVersion: resolved, cacheVersion: resolved, toolName: 'go' };
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : String(error);
                if (/Could not find a stable patch version/i.test(errorMessage)) {
                    throw new Error(`Requested Go minor ${v} has no stable patch release yet. Specify a full patch once released (e.g. ${v}.0) or use an existing released minor (e.g. 1.23).`);
                }
                throw error;
            }
        }
        
        // Should never reach here due to validation, but defensive programming
        throw new Error("Official Go version must be 'major.minor' (e.g. 1.22) or 'major.minor.patch' (e.g. 1.22.3).");
    }

    if (isMicrosoft) {
        // Microsoft aka channel: accepts major.minor, major.minor.patch, or major.minor.patch-revision
        if (parsed.hasMajorMinorOnly()) {
            // Resolve to latest patch-revision from manifest
            const resolved = await getMicrosoftLatestFromManifest(parsed);
            return { filenameVersion: resolved, cacheVersion: resolved, toolName: 'go-aka' };
        }
        
        if (parsed.hasMajorMinorPatchOnly()) {
            // Patch without revision: resolve to latest revision from manifest
            const resolved = await getMicrosoftLatestFromManifest(parsed);
            return { filenameVersion: resolved, cacheVersion: resolved, toolName: 'go-aka' };
        }
        
        if (parsed.hasMajorMinorPatchRevision()) {
            // Full version with revision specified - use as-is
            return { filenameVersion: v, cacheVersion: v, toolName: 'go-aka' };
        }
        
        // Should never reach here due to validation, but defensive programming
        throw new Error("For Microsoft Go builds use 'major.minor' (e.g. 1.25) or 'major.minor.patch' (e.g. 1.25.3 or 1.25.3-1).");
    }

    throw new Error("Invalid download URL. Only https://go.dev/dl and https://aka.ms/golang/release/latest are allowed.");
}

/**
 * Resolves the download URL by checking both task parameter and environment variable.
 * Task parameter takes precedence over environment variable.
 * @returns The resolved download URL or undefined if neither is set
 */
function resolveDownloadUrl(): string | undefined {
    // Support both task input parameter and environment variable
    const inputUrl = tl.getInput('goDownloadUrl', false);
    const envUrl = tl.getVariable('GoTool.GoDownloadUrl');

    // Determine which URL source to use (parameter takes precedence)
    let downloadUrl: string | undefined;
    if (inputUrl && envUrl) {
        tl.debug('Both goDownloadUrl parameter and GoTool.GoDownloadUrl environment variable are set. Using parameter value.');
        downloadUrl = inputUrl;
    } else if (envUrl) {
        tl.debug('Using GoTool.GoDownloadUrl environment variable for download URL.');
        downloadUrl = envUrl;
    } else {
        downloadUrl = inputUrl;
    }

    return downloadUrl;
}

run();