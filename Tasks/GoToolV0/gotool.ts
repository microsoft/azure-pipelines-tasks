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
        let downloadBaseUrl: string = tl.getInput('goDownloadUrl', false);
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
    // Always append the filename; aka.ms/golang/release/latest supports per-file paths.
    let base = (baseUrl && baseUrl.trim()) ? baseUrl.trim() : "https://storage.googleapis.com/golang";
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
    return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?$/.test(version.trim());
}

function hasMajorMinorOnly(version: string): boolean {
    return /^\d+\.\d+$/.test(version.trim());
}

function isOfficialBaseUrl(baseUrl?: string): boolean {
    if (!baseUrl || !baseUrl.trim()) return true;
    const raw = baseUrl.trim();
    try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase();
        const p = u.pathname.replace(/\/+$/, '').toLowerCase();
        if (host === 'storage.googleapis.com' && (p === '/golang' || p === '')) return true;
        return false;
    } catch {
        return false;
    }
}

function isAkaMsLatest(baseUrl?: string): boolean {
    if (!baseUrl) return false;
    try {
        const u = new URL(baseUrl.trim());
        const host = u.hostname.toLowerCase();
        const p = u.pathname.replace(/\/+$/, '').toLowerCase();
        return host === 'aka.ms' && p === '/golang/release/latest';
    } catch {
        return false;
    }
}

async function getLatestPatchFromGoDev(majorMinorVersion: string): Promise<string> {
    const normalized = majorMinorVersion.replace(/^go/i, '').replace(/^v/i, '');
    const parts = normalized.split('.');
    if (parts.length < 2) {
        throw new Error(`Invalid major.minor version: ${majorMinorVersion}`);
    }
    const major = parseInt(parts[0], 10);
    const minor = parseInt(parts[1], 10);

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

async function getMicrosoftLatestPatchFromManifest(majorMinorVersion: string): Promise<string> {
    const mm = majorMinorVersion.replace(/^go/i, '').replace(/^v/i, '');
    const manifestUrl = `https://aka.ms/golang/release/latest/go${mm}.assets.json`;
    tl.debug(`Downloading Microsoft Go manifest from ${manifestUrl}`);
    let jsonPath: string;
    try {
        jsonPath = await toolLib.downloadTool(manifestUrl);
    } catch (e) {
        throw new Error(`Failed to download Microsoft Go manifest for ${majorMinorVersion}: ${(e as any).message}`);
    }
    const raw = fs.readFileSync(jsonPath, 'utf8');

    let parsed: any;
    try {
        parsed = JSON.parse(raw);
    } catch {
        parsed = undefined;
    }

    let full: string | undefined;
    if (parsed && typeof parsed === 'object') {
        if (typeof parsed.version === 'string') {
            full = parsed.version;
        } else if (Array.isArray(parsed.assets)) {
            for (const a of parsed.assets) {
                if (a && typeof a.version === 'string') {
                    full = a.version;
                    break;
                }
            }
        }
    }

    if (!full) {
        // Fallback regex scan
        const m = /"version"\s*:\s*"go(\d+\.\d+\.\d+)"/.exec(raw) || /"go(\d+\.\d+\.\d+)"/.exec(raw);
        if (m) {
            full = `go${m[1]}`;
        }
    }

    if (!full) {
        throw new Error(`Could not resolve full patch version from Microsoft manifest for ${majorMinorVersion}`);
    }
    // Accept versions with or without a leading 'go' prefix and optional prerelease/build metadata
    // Examples: 1.24.7-1, go1.24.7-rc1, 1.24.7-1+meta, go1.24.7
    const semverMatch = /^(?:go)?(\d+\.\d+\.\d+(?:-[0-9A-Za-z-.]+)?(?:\+[0-9A-Za-z-.]+)?)$/.exec(full.trim());
    if (!semverMatch) {
        throw new Error(`Unexpected version format in Microsoft manifest: ${full}`);
    }
    return semverMatch[1];
}

async function resolveVersionAndCache(version: string, baseUrl?: string): Promise<{ filenameVersion: string, cacheVersion?: string, toolName: string }> {
    const v = version.trim().replace(/^v/i, '');
    if (!v) {
        throw new Error("Version input resolved to empty string.");
    }
    const official = isOfficialBaseUrl(baseUrl);
    const akaLatest = isAkaMsLatest(baseUrl);
    // Cache differentiation: use distinct toolName values ('go' vs 'go-aka') so cacheVersion can remain a pure semver.
    // cacheVersion MUST be a valid semver string accepted by tool-lib; adding prefixes caused null normalization and failures.

    if (official) {
        if (isSemverWithPatch(v)) {
            return { filenameVersion: v, cacheVersion: v, toolName: 'go' };
        }
        if (hasMajorMinorOnly(v)) {
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

    if (akaLatest) {
        if (isSemverWithPatch(v)) {
            // Already a full patch; cache directly
            return { filenameVersion: v, cacheVersion: v, toolName: 'go-aka' };
        }
        if (hasMajorMinorOnly(v)) {
            const resolved = await getMicrosoftLatestPatchFromManifest(v);
            return { filenameVersion: resolved, cacheVersion: resolved, toolName: 'go-aka' };
        }
        throw new Error("For https://aka.ms/golang/release/latest use 'major.minor' (e.g. 1.25) or 'major.minor.patch' (e.g. 1.25.3).");
    }

    throw new Error("Unsupported custom baseUrl. Only https://storage.googleapis.com/golang and https://aka.ms/golang/release/latest are allowed.");
}

run();
