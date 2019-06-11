import * as os from 'os';
import * as path from 'path';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as tl from 'azure-pipelines-task-lib/task';
import * as util from 'util';
import * as yaml from 'js-yaml';
import * as fs from 'fs';
import { getExecutableExtension } from './utility';

const kubectlToolName = 'kubectl';
export const stableKubectlVersion = 'v1.14.0';

// get a stable version from the url https://storage.googleapis.com/kubernetes-release/release/stable.txt
export async function getStableKubectlVersion(): Promise<string> {
    let version;
    const stableVersionUrl = 'https://storage.googleapis.com/kubernetes-release/release/stable.txt';
    return toolLib.downloadTool(stableVersionUrl).then((downloadPath) => {
        version = fs.readFileSync(downloadPath, 'utf8').toString().trim();
        if (!version) {
            version = stableKubectlVersion;
        }
        return version;
    }, (reject) => {
        tl.debug(reject);
        tl.warning(tl.loc('DownloadStableVersionFailed', stableVersionUrl, stableKubectlVersion));
        return stableKubectlVersion;
    });
}

export async function downloadKubectl(version: string): Promise<string> {
    let cachedToolpath = toolLib.findLocalTool(kubectlToolName, version);
    let kubectlDownloadPath = '';
    if (!cachedToolpath) {
        try {
            kubectlDownloadPath = await toolLib.downloadTool(getkubectlDownloadURL(version));
        } catch (exception) {
            throw new Error(tl.loc('DownloadKubectlFailedFromLocation', getkubectlDownloadURL(version), exception));
        }

        cachedToolpath = await toolLib.cacheFile(kubectlDownloadPath, kubectlToolName + getExecutableExtension(), kubectlToolName, version);
    }

    const kubectlPath = path.join(cachedToolpath, kubectlToolName + getExecutableExtension());

    if (!cachedToolpath || !fs.existsSync(kubectlPath)) {
        const kubectlPathTmp = path.join(getTempDirectory(), kubectlToolName + getExecutableExtension());
        tl.cp(kubectlDownloadPath, kubectlPathTmp, '-f');
        fs.chmodSync(kubectlPathTmp, '777');
        return kubectlPathTmp;
    }

    fs.chmodSync(kubectlPath, '777');
    return kubectlPath;
}

export function createKubeconfig(kubernetesServiceEndpoint: string): string {
    const kubeconfigTemplateString = '{"apiVersion":"v1","kind":"Config","clusters":[{"cluster":{"certificate-authority-data": null,"server": null}}], "users":[{"user":{"token": null}}]}';
    const kubeconfigTemplate = JSON.parse(kubeconfigTemplateString);

    //populate server url, ca cert and token fields
    kubeconfigTemplate.clusters[0].cluster.server = tl.getEndpointUrl(kubernetesServiceEndpoint, false);
    kubeconfigTemplate.clusters[0].cluster['certificate-authority-data'] = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'serviceAccountCertificate', false);
    const base64ApiToken = Buffer.from(tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'apiToken', false), 'base64');
    kubeconfigTemplate.users[0].user.token = base64ApiToken.toString();

    return JSON.stringify(kubeconfigTemplate);
}

function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

function getkubectlDownloadURL(version: string): string {
    switch (os.type()) {
        case 'Linux':
            return util.format('https://storage.googleapis.com/kubernetes-release/release/%s/bin/linux/amd64/kubectl', version);

        case 'Darwin':
            return util.format('https://storage.googleapis.com/kubernetes-release/release/%s/bin/darwin/amd64/kubectl', version);

        case 'Windows_NT':
        default:
            return util.format('https://storage.googleapis.com/kubernetes-release/release/%s/bin/windows/amd64/kubectl.exe', version);

    }
}

export function getKubeconfigForCluster(kubernetesServiceEndpoint: string): string {
    const kubeconfig = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'kubeconfig', false);
    const clusterContext = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'clusterContext', true);
    if (!clusterContext) {
        return kubeconfig;
    }

    const kubeconfigTemplate = yaml.safeLoad(kubeconfig);
    kubeconfigTemplate['current-context'] = clusterContext;
    const modifiedKubeConfig = yaml.safeDump(kubeconfigTemplate);
    return modifiedKubeConfig.toString();
}

