import * as os from 'os';
import * as path from 'path';
import * as taskLib from 'azure-pipelines-task-lib/task';
import { AZURE_KV_PLUGIN_VERSION_FILE, NOTATION, NOTATION_BINARY, PLUGINS } from './lib/constants';
import { IExecOptions, ToolRunner } from 'azure-pipelines-task-lib/toolrunner';
import { getDownloadInfo, installFromURL } from './lib/install';
import { getArtifactReferences } from './lib/variables';
import { getConfigHome } from './lib/fs';
import { getVaultCredentials } from './lib/credentials';
import { notationRunner } from './lib/runner';

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
            const keyVaultPluginEnv = { ...env, ...await getVaultCredentials() }
            await installAzureKV(akvPluginVersion);
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
                    .argIf(debug && debug.toLowerCase() === 'true', '--debug')
                    .exec(execOptions);
            })
            break;
        default:
            throw new Error(taskLib.loc('UnknownPlugin', pluginName));
    }
}

// install azurekv plugin
async function installAzureKV(versionPrefix: string): Promise<void> {
    // check if the plugin is already installed
    let binaryName = 'notation-azure-kv';
    if (os.platform() == 'win32') {
        binaryName += '.exe';
    }
    const pluginDir = path.join(getConfigHome(), NOTATION, PLUGINS, 'azure-kv');
    if (taskLib.exist(path.join(pluginDir, binaryName))) {
        console.log(taskLib.loc('AzureKVPluginAlreadyInstalled'));
    } else {
        // get azure-kv latest v1.x download info
        const downloadInfo = getDownloadInfo(versionPrefix, AZURE_KV_PLUGIN_VERSION_FILE);
        await installFromURL(downloadInfo.url, downloadInfo.checksum, pluginDir);
    }
    taskLib.tool(NOTATION_BINARY).arg(['plugin', 'list']).execSync();
}
