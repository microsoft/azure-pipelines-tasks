import * as taskLib from 'azure-pipelines-task-lib/task';
import { IExecOptions, ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import * as os from 'os';
import * as path from 'path';
import { AZURE_KV_PLUGIN_VERSION_FILE, NOTATION, NOTATION_BINARY, PLUGINS } from './lib/constants';
import { getVaultCredentials } from './lib/credentials';
import { getConfigHome } from './lib/fs';
import { getDownloadInfo, installFromURL } from './lib/install';
import { notationRunner } from './lib/runner';
import { getArtifactReferences } from './lib/variables';

export async function sign(): Promise<void> {
    const artifactRefs = getArtifactReferences();
    const keyid = taskLib.getInput('keyid', true) || '';
    const signatureFormat = taskLib.getInput('signatureFormat', false) || 'cose';
    const allowReferrerAPI = taskLib.getBoolInput('allowReferrersAPI', false);
    const debug = taskLib.getVariable('system.debug');
    let env = { ...process.env };
    if (allowReferrerAPI) {
        env["NOTATION_EXPERIMENTAL"] = "1";
    }

    const pluginName = taskLib.getInput('plugin', true);
    switch (pluginName) {
        case 'azureKeyVault':
            // azure-kv plugin specific inputs
            const akvPluginVersion = taskLib.getInput('akvPluginVersion', true) || '';
            const caCertBundle = taskLib.getInput('caCertBundle', false) || '';
            const selfSignedCert = taskLib.getBoolInput('selfSigned', false);
            const [credentialEnvs, credentialType] = await getVaultCredentials();
            const keyVaultPluginEnv = { ...env, ...credentialEnvs}
            const installedVersion = await installAzureKV(akvPluginVersion);
            await notationRunner(artifactRefs, async (notation: ToolRunner, artifactRef: string, execOptions: IExecOptions) => {
                execOptions.env = keyVaultPluginEnv;
                return notation
                    .arg(['sign', artifactRef,
                        '--plugin', 'azure-kv',
                        '--id', keyid,
                        '--signature-format', signatureFormat])
                    .argIf(allowReferrerAPI, '--allow-referrers-api')
                    .argIf(caCertBundle, `--plugin-config=ca_certs=${caCertBundle}`)
                    .argIf(selfSignedCert, '--plugin-config=self_signed=true')
                    .argIf(isSupportCredentialType(installedVersion), `--plugin-config=credential_type=${credentialType}`)
                    .argIf(debug && debug.toLowerCase() === 'true', '--debug')
                    .exec(execOptions);
            })
            break;
        default:
            throw new Error(taskLib.loc('UnknownPlugin', pluginName));
    }
}

// install azurekv plugin and return the installed version
//
// the versionPrefix is the version range to match the version of the plugin
// For example: 1, 1.1, 1.1.0
async function installAzureKV(versionPrefix: string): Promise<string> {
    // check if the plugin is already installed
    let binaryName = 'notation-azure-kv';
    if (os.platform() == 'win32') {
        binaryName += '.exe';
    }
    const pluginDir = path.join(getConfigHome(), NOTATION, PLUGINS, 'azure-kv');
    const downloadInfo = getDownloadInfo(versionPrefix, AZURE_KV_PLUGIN_VERSION_FILE);

    if (taskLib.exist(path.join(pluginDir, binaryName))) {
        // if the plugin is already installed, check if the version is the same
        // as the expected version
        const currentVersion = await getPluginVersion('azure-kv');
        if (currentVersion === downloadInfo.version) {
            console.log(taskLib.loc('AzureKVPluginAlreadyInstalled', currentVersion));
        }
    } else {
        await installFromURL(downloadInfo.url, downloadInfo.checksum, pluginDir);
    }

    taskLib.tool(NOTATION_BINARY).arg(['plugin', 'list']).execSync();
    return downloadInfo.version;
}

function isSupportCredentialType(version: string): boolean {
    // if version >= 1.1.0, support credential type
    const versionParts = version.split('.');
    if (versionParts.length < 2) {
        return false;
    }

    if (parseInt(versionParts[0]) > 1) {
        return true;
    }

    if (parseInt(versionParts[0]) === 1 && parseInt(versionParts[1]) >= 1) {
        return true;
    }

    return false
}

function getPluginVersion(pluginName: string): string {
    const result = taskLib.tool(NOTATION).arg(['plugin', 'list']).execSync();
    if (result.code !== 0) {
        return '';
    }

    const lines = result.stdout.split('\n');
    for (const line of lines.slice(1)) {
        // example:
        // azure-kv  Notation Azure Key Vault plugin  1.1.0  [SIGNATURE_GENERATOR.RAW]  <nil> 
        if (line.startsWith(pluginName)) {
            const parts = line.trim().split('  ');
            let nonEmptyParts = parts.filter(part => part !== '');
            console.log(nonEmptyParts);
            return nonEmptyParts.slice(-3)[0].trim();
        }
    }
    return '';
}
