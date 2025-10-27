import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as tl from 'azure-pipelines-task-lib/task';
import * as os from 'os';
import * as path from 'path';
import * as util from 'util';
import * as telemetry from 'azure-pipelines-tasks-utility-common/telemetry';
import * as fs from 'fs';

let osPlat: string = os.platform();
let osArch: string = os.arch();

async function run() {
    try {
        const rawVersion = tl.getInput('version', true);
        if (!rawVersion || ['null','undefined',''].includes(rawVersion.trim().toLowerCase())) {
            throw new Error("Input 'version' is required and must not be empty, 'null' or 'undefined'.");
        }
        const version = rawVersion.trim();
        let downloadBaseUrl: string = tl.getInput('goDownloadBaseUrl', false);
        const resolvedVersion = await getGo(version, downloadBaseUrl);
        telemetry.emitTelemetry('TaskHub', 'GoToolV0', { version: resolvedVersion, customBaseUrl: String(!!downloadBaseUrl) });
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

async function acquireGo(filenameVersion: string, baseUrl?: string, cacheVersion?: string, toolName: string = 'go'): Promise<string> {
    let fileName: string = getFileName(filenameVersion);
    let downloadUrl: string = getDownloadUrl(fileName, baseUrl);
    tl.debug(`Resolved Go download URL: ${downloadUrl}`);
    console.log(`Downloading Go from ${downloadUrl}`);
    let downloadPath: string = null;
    try {
        downloadPath = await toolLib.downloadTool(downloadUrl);
    } catch (error) {
        tl.debug(error);
        throw (util.format(
            "Failed to download version %s. Please verify that the version is valid and resolve any other issues. %s",
            filenameVersion, error));
    }

    tl.assertAgent('2.115.0');

    let extPath: string = tl.getVariable('Agent.TempDirectory');
    if (!extPath) {
        throw new Error("Expected Agent.TempDirectory to be set");
    }

    if (osPlat == 'win32') {
        extPath = await toolLib.extractZip(downloadPath);
    } else {
        extPath = await toolLib.extractTar(downloadPath);
    }

    let toolRoot = path.join(extPath, "go");
    if (cacheVersion) {
        tl.debug(`Invoking cacheDir with tool='${toolName}' cacheVersion='${cacheVersion}' (type=${typeof cacheVersion})`);
        return await toolLib.cacheDir(toolRoot, toolName, cacheVersion);
    } else {
        tl.debug(`Skipping cacheDir because cacheVersion='${cacheVersion}'`);
    }
    return toolRoot;
}

function getFileName(version: string): string {
    let platform: string = osPlat == "win32" ? "windows" : osPlat;
    let arch: string;
    if (osArch == "x64") {
        arch = "amd64";
    } else if (osArch == "arm64") {
        arch = "arm64";
    } else {
        arch = "386";
    }
    let ext: string = osPlat == "win32" ? "zip" : "tar.gz";
    return util.format("go%s.%s-%s.%s", version, platform, arch, ext);
}

function getDownloadUrl(filename: string, baseUrl?: string): string {
    let base = (baseUrl && baseUrl.trim()) ? baseUrl.trim() : "https://go.dev/dl";
    base = base.replace(/\/+$/, '');
    return `${base}/${filename}`;
}

function setGoEnvironmentVariables(goRoot: string) {
    tl.setVariable('GOROOT', goRoot);
    let goPath: string = tl.getInput("goPath", false);
    let goBin: string = tl.getInput("goBin", false);
    if (!util.isNullOrUndefined(goPath)) {
        tl.setVariable("GOPATH", goPath);
    }
    if (!util.isNullOrUndefined(goBin)) {
        tl.setVariable("GOBIN", goBin);
    }
}

function isSemverWithPatch(version: string): boolean {
    // Accepts versions of the form major.minor.patch or major.minor.patch-revision
    return /^\d+\.\d+\.\d+(?:-\d+)?$/.test(version);
}

function hasMajorMinorOnly(version: string): boolean {
    return /^\d+\.\d+$/.test(version);
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
        this.major = major;
        this.minor = minor;
        this.patch = patch;
        this.revision = revision;
        this.original = original || '';
    }
    
    // Helper methods for clear version classification
    hasPatchOnly(): boolean {
        return this.patch !== undefined && this.revision === undefined;
    }
    
    hasRevision(): boolean {
        return this.revision !== undefined;
    }
    
    isMajorMinorOnly(): boolean {
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

function parseGoVersionParts(input: string): { major: number; minor: number; patch?: number } {
    const parsed = parseGoVersion(input);
    return {
        major: parsed.major,
        minor: parsed.minor,
        patch: parsed.patch
    };
}

async function getLatestPatchFromGoDev(majorMinorVersion: string): Promise<string> {
    // Unified parsing helper (also used by Microsoft manifest resolver) to avoid index discrepancies.
    const { major, minor } = parseGoVersionParts(majorMinorVersion);

    const metadataUrl = 'https://go.dev/dl/?mode=json&include=all';
    let jsonPath: string;
    try {
        tl.debug(`Downloading Go releases metadata from ${metadataUrl}`);
        jsonPath = await toolLib.downloadTool(metadataUrl);
    } catch (error) {
        throw new Error(`Failed to download Go releases metadata: ${(error as any).message}`);
    }
    const raw = fs.readFileSync(jsonPath, 'utf8');

    let releases: any[];
    try {
        releases = JSON.parse(raw);
    } catch {
        throw new Error('Failed to parse Go releases metadata from go.dev');
    }

    let maxPatch = -1;
    for (const rel of releases) {
        if (!rel || !rel.version || rel.stable !== true) continue;
        const v: string = String(rel.version);
        const m = /^go(\d+)\.(\d+)(?:\.(\d+))?$/i.exec(v);
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


async function getMicrosoftLatestFromManifest(majorMinorOrPatch: string): Promise<string> {
    const parts = parseGoVersionParts(majorMinorOrPatch);
    let manifestId = `${parts.major}.${parts.minor}`;
    if (typeof parts.patch === 'number') {
        manifestId = `${parts.major}.${parts.minor}.${parts.patch}`;
    }
    const manifestUrl = `https://aka.ms/golang/release/latest/go${manifestId}.assets.json`;
    tl.debug(`Downloading Microsoft build of Go manifest from ${manifestUrl}`);
    let jsonPath: string;
    try {
        jsonPath = await toolLib.downloadTool(manifestUrl);
    } catch (e) {
        throw new Error(`Failed to download Microsoft Go manifest for ${manifestId}: ${(e as any).message}`);
    }
    const raw = fs.readFileSync(jsonPath, 'utf8');
    let parsed: any;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Failed to parse Microsoft Go manifest JSON');
    }
    if (!parsed || typeof parsed.version !== 'string') {
        throw new Error('Microsoft manifest missing top-level version');
    }
    const ver = String(parsed.version).trim();
    const m = /^(?:go)?(\d+\.\d+\.\d(?:-\d+)?)$/i.exec(ver);
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
    let parsed: ParsedGoVersion;
    try {
        parsed = parseGoVersion(v);
    } catch (e: any) {
        throw new Error(`Invalid version format: ${version}`);
    }
    
    const channel = classifyBaseUrl(baseUrl);
    const isOfficial = channel.type === 'official';
    const isMicrosoft = channel.type === 'microsoft';
    // Cache differentiation: use distinct toolName values ('go' vs 'go-aka') so cacheVersion can remain a pure semver.
    // cacheVersion MUST be a valid semver string accepted by tool-lib; adding prefixes caused null normalization and failures.

    if (isOfficial) {
        // Official Go: only accepts major.minor or major.minor.patch (no revision)
        if (parsed.hasRevision()) {
            throw new Error("Official Go version must be 'major.minor' (e.g. 1.22) or 'major.minor.patch' (e.g. 1.22.3).");
        }
        
        if (parsed.hasPatchOnly()) {
            // Full patch version specified - use as-is
            return { filenameVersion: v, cacheVersion: v, toolName: 'go' };
        }
        
        if (parsed.isMajorMinorOnly()) {
            // Resolve to latest patch
            let resolved: string | undefined;
            try {
                resolved = await getLatestPatchFromGoDev(v);
            } catch (e: any) {
                const msg = String(e?.message || e || '');
                if (/Could not find a stable patch version/i.test(msg)) {
                    throw new Error(`Requested Go minor ${v} has no stable patch release yet. Specify a full patch once released (e.g. ${v}.0) or use an existing released minor (e.g. 1.23).`);
                }
                throw new Error(`Failed to resolve latest patch for ${v}: ${msg}`);
            }
            if (!resolved) {
                throw new Error(`Could not resolve a stable patch for ${v}.`);
            }
            return { filenameVersion: resolved, cacheVersion: resolved, toolName: 'go' };
        }
        
        throw new Error("Official Go version must be 'major.minor' (e.g. 1.22) or 'major.minor.patch' (e.g. 1.22.3).");
    }

    if (isMicrosoft) {
        // Microsoft aka channel: accepts major.minor, major.minor.patch, or major.minor.patch-revision
        if (parsed.isMajorMinorOnly()) {
            // Resolve to latest patch-revision from manifest
            const resolved = await getMicrosoftLatestFromManifest(v);
            return { filenameVersion: resolved, cacheVersion: resolved, toolName: 'go-aka' };
        }
        
        if (parsed.hasPatchOnly()) {
            // Patch without revision: resolve to latest revision from manifest
            const resolved = await getMicrosoftLatestFromManifest(v);
            return { filenameVersion: resolved, cacheVersion: resolved, toolName: 'go-aka' };
        }
        
        if (parsed.hasRevision()) {
            // Full version with revision specified - use as-is
            return { filenameVersion: v, cacheVersion: v, toolName: 'go-aka' };
        }
        
        throw new Error("For Microsoft Go builds use 'major.minor' (e.g. 1.25) or 'major.minor.patch' (e.g. 1.25.3 or 1.25.3-1).");
    }

    throw new Error("Invalid download URL. Only https://go.dev/dl and https://aka.ms/golang/release/latest are allowed.");
}

run();