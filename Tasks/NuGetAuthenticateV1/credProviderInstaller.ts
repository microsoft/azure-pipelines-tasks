import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as tl from 'azure-pipelines-task-lib/task';
import * as toollib from 'azure-pipelines-tool-lib/tool';

const CRED_PROVIDER_VERSION = '2.0.0';
const CRED_PROVIDER_BASE_URL = `https://vstsagenttools.blob.core.windows.net/tools/NuGetCredProvider/${CRED_PROVIDER_VERSION}`;

interface PlatformArchive {
    url: string;
    isZip: boolean;
    fallbackFrom?: string; // Indicates this was a fallback (e.g. "win-arm64 -> win-x64")
}

function getPlatformArchive(): PlatformArchive | null {
    const platform = os.platform();
    const arch = os.arch();
    const key = `${platform}-${arch}`;

    switch (key) {
        case 'win32-x64':
            return { url: `${CRED_PROVIDER_BASE_URL}/win-x64.zip`, isZip: true };
        case 'win32-arm64':
            // No win-arm64 archive available — fall back to x64 (runs under emulation)
            return { url: `${CRED_PROVIDER_BASE_URL}/win-x64.zip`, isZip: true, fallbackFrom: 'win-arm64' };
        case 'darwin-x64':
            return { url: `${CRED_PROVIDER_BASE_URL}/osx-x64.zip`, isZip: true };
        case 'darwin-arm64':
            return { url: `${CRED_PROVIDER_BASE_URL}/osx-arm64.zip`, isZip: true };
        case 'linux-x64':
            return { url: `${CRED_PROVIDER_BASE_URL}/linux-x64.tar.gz`, isZip: false };
        case 'linux-arm64':
            return { url: `${CRED_PROVIDER_BASE_URL}/linux-arm64.tar.gz`, isZip: false };
        default:
            return null;
    }
}

function getUserProfileNuGetPluginsDir(): string {
    return path.join(os.homedir(), '.nuget', 'plugins');
}

/**
 * Recursively search for a directory named 'CredentialProvider.Microsoft' within the given root.
 * Returns the first match, or null if not found.
 */
function findCredProviderDir(root: string): string | null {
    const entries = fs.readdirSync(root, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            const fullPath = path.join(root, entry.name);
            if (entry.name === 'CredentialProvider.Microsoft') {
                return fullPath;
            }
            const nested = findCredProviderDir(fullPath);
            if (nested) return nested;
        }
    }
    return null;
}

function copyDirSync(src: string, dest: string): void {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);
        if (entry.isDirectory()) {
            copyDirSync(srcPath, destPath);
        } else {
            fs.copyFileSync(srcPath, destPath);
        }
    }
}

function installToPluginsDir(sourceCredProviderDir: string, pluginType: 'netfx' | 'netcore', overwrite: boolean): void {
    const dest = path.join(getUserProfileNuGetPluginsDir(), pluginType, 'CredentialProvider.Microsoft');

    if (fs.existsSync(dest) && !overwrite) {
        tl.debug(`Credential provider already installed at ${dest}, skipping (overwrite=false).`);
        return;
    }

    if (fs.existsSync(dest) && overwrite) {
        tl.debug(`Removing existing credential provider at ${dest} before overwrite.`);
        fs.rmSync(dest, { recursive: true, force: true });
    }

    tl.debug(`Copying credential provider from ${sourceCredProviderDir} to ${dest}`);
    copyDirSync(sourceCredProviderDir, dest);
    console.log(tl.loc('CredProvider_Installed', pluginType, dest));
}

/**
 * Install the netfx credential provider from the bundled c.zip (ArtifactsCredProvider directory).
 */
function installBundledNetfx(overwrite: boolean): void {
    const taskRoot = path.dirname(__dirname);
    const netfxSource = path.join(taskRoot, 'ArtifactsCredProvider', 'plugins', 'netfx', 'CredentialProvider.Microsoft');

    if (!fs.existsSync(netfxSource)) {
        tl.debug('Bundled netfx credential provider not found, skipping netfx installation.');
        return;
    }

    installToPluginsDir(netfxSource, 'netfx', overwrite);
}

async function downloadAndExtract(archive: PlatformArchive): Promise<string> {
    console.log(tl.loc('CredProvider_Downloading', archive.url));
    const downloadPath = await toollib.downloadTool(archive.url);

    if (archive.isZip) {
        return await toollib.extractZip(downloadPath);
    } else {
        return await toollib.extractTar(downloadPath);
    }
}

/**
 * Downloads and installs the platform-appropriate credential provider at runtime.
 *
 * On Windows, also installs the bundled netfx provider.
 * Falls back gracefully when the platform is unsupported or download fails.
 */
export async function downloadAndInstallCredProvider(overwrite: boolean): Promise<void> {
    const archive = getPlatformArchive();

    if (!archive) {
        const key = `${os.platform()}-${os.arch()}`;
        tl.warning(tl.loc('CredProvider_UnsupportedPlatform', key));
        // Best-effort: try bundled netfx on Windows
        if (os.platform() === 'win32') {
            installBundledNetfx(overwrite);
        }
        return;
    }

    if (archive.fallbackFrom) {
        console.log(tl.loc('CredProvider_PlatformFallback', archive.fallbackFrom, archive.url));
    }

    // On Windows, install the bundled netfx provider alongside the downloaded netcore one
    if (os.platform() === 'win32') {
        installBundledNetfx(overwrite);
    }

    // Skip download if the netcore provider is already installed and overwrite is not requested
    const netcoreDest = path.join(getUserProfileNuGetPluginsDir(), 'netcore', 'CredentialProvider.Microsoft');
    if (fs.existsSync(netcoreDest) && !overwrite) {
        tl.debug(`Credential provider already installed at ${netcoreDest}, skipping download.`);
        return;
    }

    try {
        const extractedDir = await downloadAndExtract(archive);

        const credProviderDir = findCredProviderDir(extractedDir);
        if (!credProviderDir) {
            throw new Error(`CredentialProvider.Microsoft directory not found in extracted archive at ${extractedDir}`);
        }

        // Platform-specific archives are always self-contained netcore; only c.zip has netfx
        installToPluginsDir(credProviderDir, 'netcore', overwrite);

    } catch (err) {
        tl.warning(tl.loc('CredProvider_DownloadFailed', String(err)));

        // Fallback: on Windows the netfx provider was already installed above.
        // On Linux/macOS there's no bundled fallback — the task will fail on the NuGet side
        // if the credential provider is needed but not installed.
        if (os.platform() !== 'win32') {
            throw new Error(tl.loc('CredProvider_DownloadFailedNonWindows', String(err)));
        }
    }
}
