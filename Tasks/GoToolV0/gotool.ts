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
        let version = tl.getInput('version', true).trim();
        let downloadBaseUrl: string = tl.getInput('goDownloadUrl', false);
        await getGo(version, downloadBaseUrl);
        telemetry.emitTelemetry('TaskHub', 'GoToolV0', { version, customBaseUrl: String(!!downloadBaseUrl) });
    }
    catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

async function getGo(version: string, baseUrl?: string) {
    // Resolve version and caching strategy
    const resolved = await resolveVersionAndCache(version, baseUrl);
    let toolPath: string | null = null;

    if (resolved.cacheVersion) {
        toolPath = toolLib.findLocalTool('go', resolved.cacheVersion);
    }

    if (!toolPath) {
        // download, extract, and optionally cache
        toolPath = await acquireGo(resolved.filenameVersion, baseUrl, resolved.cacheVersion);
        tl.debug("Go tool is available under " + toolPath);
    }

    setGoEnvironmentVariables(toolPath);

    const binPath = path.join(toolPath, 'bin');
    // prepend the tools path. instructs the agent to prepend for future tasks
    toolLib.prependPath(binPath);
}


async function acquireGo(filenameVersion: string, baseUrl?: string, cacheVersion?: string): Promise<string> {
    //
    // Download - a tool installer intimately knows how to get the tool (and construct urls)
    //
    let fileName: string = getFileName(filenameVersion);
    let downloadUrl: string = getDownloadUrl(fileName, baseUrl);
    // Always log the actual download URL
    tl.debug(`Resolved Go download URL: ${downloadUrl}`);
    console.log(`Downloading Go from ${downloadUrl}`);
    let downloadPath: string = null;
    try {
        downloadPath = await toolLib.downloadTool(downloadUrl);
    } catch (error) {
        tl.debug(error);

        // cannot localized the string here because to localize we need to set the resource file.
        // which can be set only once. azure-pipelines-tool-lib/tool, is already setting it to different file.
        // So left with no option but to hardcode the string. Other tasks are doing the same.
        throw (util.format("Failed to download version %s. Please verify that the version is valid and resolve any other issues. %s", filenameVersion, error));
    }

    //make sure agent version is latest then 2.115.0
    tl.assertAgent('2.115.0');

    //
    // Extract
    //
    let extPath: string;
    extPath = tl.getVariable('Agent.TempDirectory');
    if (!extPath) {
        throw new Error("Expected Agent.TempDirectory to be set");
    }

    if (osPlat == 'win32') {
        extPath = await toolLib.extractZip(downloadPath);
    }
    else {
        extPath = await toolLib.extractTar(downloadPath);
    }

    //
    // Install into the local tool cache - node extracts with a root folder that matches the fileName downloaded
    //
    let toolRoot = path.join(extPath, "go");
    if (cacheVersion) {
        return await toolLib.cacheDir(toolRoot, 'go', cacheVersion);
    }
    // If cacheVersion is not provided, use the extracted path directly (no caching)
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
    let filename: string = util.format("go%s.%s-%s.%s", version, platform, arch, ext);
    return filename;
}

function getDownloadUrl(filename: string, baseUrl?: string): string {
    let base: string = (baseUrl && baseUrl.trim()) ? baseUrl.trim() : "https://storage.googleapis.com/golang";
    base = base.replace(/\/+$/, '');
    return util.format("%s/%s", base, filename);
}

function setGoEnvironmentVariables(goRoot: string) {
    tl.setVariable('GOROOT', goRoot);

    let goPath: string = tl.getInput("goPath", false);
    let goBin: string = tl.getInput("goBin", false);

    // set GOPATH and GOBIN as user value
    if (!util.isNullOrUndefined(goPath)) {
        tl.setVariable("GOPATH", goPath);
    }
    if (!util.isNullOrUndefined(goBin)) {
        tl.setVariable("GOBIN", goBin);
    }
}

function isSemverWithPatch(version: string): boolean {
    return /^\d+\.\d+\.\d+$/.test(version.trim());
}

function hasMajorMinorOnly(version: string): boolean {
    return /^\d+\.\d+$/.test(version.trim());
}

function isOfficialBaseUrl(baseUrl?: string): boolean {
    // Treat as official only when:
    // - No baseUrl provided (defaults to Google storage), or
    // - Exact known Google hosts and paths:
    //    * https://storage.googleapis.com/golang
    if (!baseUrl || !baseUrl.trim()) return true;

    const raw = baseUrl.trim();
    try {
        const u = new URL(raw);
        const host = u.hostname.toLowerCase();
        const p = u.pathname.replace(/\/+$/, '').toLowerCase(); // strip trailing slashes

        if (host === 'storage.googleapis.com' && (p === '/golang' || p === '')) return true;

        // Any other host/path is treated as custom (non-official)
        return false;
    } catch {
        // Invalid URL string => treat as custom to avoid unintended metadata fetch
        return false;
    }
}

function includesLatestKeyword(url?: string): boolean {
    if (!url) return false;
    return url.toLowerCase().includes('latest');
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
        throw new Error(`Failed to download Go releases metadata: ${error.message}`);
    }
    const raw = fs.readFileSync(jsonPath, 'utf8');

    let releases: any[];
    try {
        releases = JSON.parse(raw);
    } catch (e) {
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

async function resolveVersionAndCache(version: string, baseUrl?: string): Promise<{ filenameVersion: string, cacheVersion?: string }> {
    const v = version.trim().replace(/^v/i, ''); // Remove leading 'v' if present to account for user mistakes
    const official = isOfficialBaseUrl(baseUrl);

    if (official) {
        if (isSemverWithPatch(v)) {
            return { filenameVersion: v, cacheVersion: v };
        }
        if (hasMajorMinorOnly(v)) {
            const resolved = await getLatestPatchFromGoDev(v);
            return { filenameVersion: resolved, cacheVersion: resolved };
        }
        // Fallback to semantic conversion for other formats (e.g., "1")
        throw new Error("For official Go URLs, the version spec must be in 'major.minor' (e.g., '1.10') or 'major.minor.patch' (e.g., '1.10.2') format.");
    } else {
        const urlHasLatest = includesLatestKeyword(baseUrl);
        if (isSemverWithPatch(v)) {
            return { filenameVersion: v, cacheVersion: v };
        }
        if (hasMajorMinorOnly(v) || /^\d+$/.test(v)) {
            if (!urlHasLatest) {
                throw new Error("Custom URL provided without 'latest' in the URL requires a full semantic version (major.minor.patch).");
            }
            // Allow major.minor (or major) when custom URL indicates 'latest'; skip caching due to unknown exact patch
            return { filenameVersion: v };
        }
        // Unknown format: try as-is (no caching)
        return { filenameVersion: v };
    }
}

run();