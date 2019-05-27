import * as os from 'os';
import * as path from 'path';
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as tl from 'vsts-task-lib/task';
import * as util from 'util';
import * as yaml from 'js-yaml';
import { WebRequest, sendRequest } from './restutilities';
import * as fs from 'fs';

const kubectlToolName = 'kubectl';
export const stableKubectlVersion = 'v1.14.0';

// get a stable version from the url https://storage.googleapis.com/kubernetes-release/release/stable.txt
export async function getStableKubectlVersion(): Promise<string> {
    const request = new WebRequest();
    request.method = 'GET';
    request.uri = 'https://storage.googleapis.com/kubernetes-release/release/stable.txt';

    return new Promise<string>((resolve, reject) => {
        const resolveWithStableVersion = () => {
            tl.warning(tl.loc('DownloadStableVersionFailed', request.uri, stableKubectlVersion));
            resolve(stableKubectlVersion);
        }
        try {
            sendRequest(request).then((response) => {
                resolve(response.body);
            }).catch((ex) => {
                resolveWithStableVersion();
            });
        } catch (ex) {
            resolveWithStableVersion();
        }
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

        cachedToolpath = await toolLib.cacheFile(kubectlDownloadPath, kubectlToolName + getExecutableExtention(), kubectlToolName, version);
    }

    const kubectlPath = path.join(cachedToolpath, kubectlToolName + getExecutableExtention());

    if (!cachedToolpath || !fs.existsSync(kubectlPath)) {
        const kubectlPathTmp = path.join(getTempDirectory(), kubectlToolName + getExecutableExtention());
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

function getExecutableExtention(): string {
    if (os.type().match(/^Win/)) {
        return '.exe';
    }

    return '';
}

export async function getAvailableKubectlVersions() {
    const request = new WebRequest();
    request.method = 'GET';
    let pageNumber = 0;
    const versions = [];
    const countPerPage = 100;
    while (true) {
        try {
            request.uri = `https://api.github.com/repos/kubernetes/kubernetes/releases?page=${pageNumber}&per_page=${countPerPage}`;
            const response = await sendRequest(request);
            // break if no more items or items are less then asked
            if (response.body.length === 0 || response.body.length < countPerPage) {
                break;
            }
            response.body.forEach(release => {
                if (release.tag_name) {
                    versions.push(release.tag_name);
                }
            });
            pageNumber++;
        } catch (error) {
            throw error;
        }
    }
    return versions;
}
