import * as os from "os";
import * as path from "path";
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as tl from "azure-pipelines-task-lib/task";
import * as downloadutility from "./downloadutility";
import * as util from "util";
import * as yaml from "js-yaml";
const uuidV4 = require('uuid/v4');
const kubectlToolName = "kubectl";
export const stableKubectlVersion = "v1.14.0";
import { WebRequest, sendRequest } from "./restutilities";

var fs = require('fs');

// get a stable version from the url https://storage.googleapis.com/kubernetes-release/release/stable.txt
export async function getStableKubectlVersion() : Promise<string> {
    var version;
    var stableVersionUrl = "https://storage.googleapis.com/kubernetes-release/release/stable.txt";
    var downloadPath = path.join(getTempDirectory(), uuidV4() +".txt");
    return downloadutility.download(stableVersionUrl, downloadPath, false, true).then((resolve) => {
        version = fs.readFileSync(downloadPath, "utf8").toString().trim();
        if(!version){
            version = stableKubectlVersion;
        }
        return version;
    },
    (reject) => {
        tl.debug(reject);
        tl.warning(tl.loc('DownloadStableVersionFailed', stableVersionUrl, stableKubectlVersion));
        return stableKubectlVersion;
    })
}


export async function downloadKubectl(version: string) : Promise<string> {
    var cachedToolpath = toolLib.findLocalTool(kubectlToolName, version);
    if(!cachedToolpath) {
        try {
                var KubectlDownloadPath = await toolLib.downloadTool(getkubectlDownloadURL(version)); 
        } catch(exception) {
            throw new Error(tl.loc("DownloadKubectlFailedFromLocation", getkubectlDownloadURL(version), exception));
        }

        cachedToolpath = await toolLib.cacheFile(KubectlDownloadPath, kubectlToolName + getExecutableExtention() , kubectlToolName, version);
    }
    
    var kubectlPath = path.join(cachedToolpath, kubectlToolName + getExecutableExtention());
    fs.chmodSync(kubectlPath, "644");
    return kubectlPath;
}

export function createKubeconfig(kubernetesServiceEndpoint: string): string
{
    var kubeconfigTemplateString = '{"apiVersion":"v1","kind":"Config","clusters":[{"cluster":{"certificate-authority-data": null,"server": null}}], "users":[{"user":{"token": null}}]}';
    var kubeconfigTemplate = JSON.parse(kubeconfigTemplateString);

    //populate server url, ca cert and token fields
    kubeconfigTemplate.clusters[0].cluster.server = tl.getEndpointUrl(kubernetesServiceEndpoint, false);
    kubeconfigTemplate.clusters[0].cluster["certificate-authority-data"] = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'serviceAccountCertificate', false);
    var base64ApiToken = Buffer.from(tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'apiToken', false), 'base64');
    kubeconfigTemplate.users[0].user.token = base64ApiToken.toString();

    return JSON.stringify(kubeconfigTemplate);
}

function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}

function getkubectlDownloadURL(version: string) : string {
    switch(os.type())
    {
        case 'Linux':
            return util.format("https://storage.googleapis.com/kubernetes-release/release/%s/bin/linux/amd64/kubectl", version);

        case 'Darwin':
            return util.format("https://storage.googleapis.com/kubernetes-release/release/%s/bin/darwin/amd64/kubectl", version);

        default:
        case 'Windows_NT':
            return util.format("https://storage.googleapis.com/kubernetes-release/release/%s/bin/windows/amd64/kubectl.exe", version);   

    }
}

export function getKubeconfigForCluster(kubernetesServiceEndpoint: string): string
{
    var kubeconfig = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'kubeconfig', false);
    var clusterContext = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'clusterContext', true);
    if (!clusterContext)
    {
        return kubeconfig;
    }

    var kubeconfigTemplate = yaml.safeLoad(kubeconfig);
    kubeconfigTemplate["current-context"] = clusterContext;
    var modifiedKubeConfig = yaml.safeDump(kubeconfigTemplate);
    return modifiedKubeConfig.toString();
}

function getExecutableExtention(): string {
    if(os.type().match(/^Win/)){
        return ".exe";
    }

    return "";
}

export async function getAvailableKubectlVersions() {
    var request = new WebRequest();
    request.method = "GET";
    let page_number = 0;
    let versions = [];
    const countPerPage = 100;
    while (true) {
        try {
            request.uri = `https://api.github.com/repos/kubernetes/kubernetes/releases?page=${page_number}&per_page=${countPerPage}`;
            var response = await sendRequest(request);
            // break if no more items or items are less then asked
            if (response.body.length === 0 || response.body.length < countPerPage) {
                break;
            }
            response.body.forEach(release => {
                if (release["tag_name"]) {
                    versions.push(release["tag_name"]);
                }
            });
            page_number++;
        } catch (error) {
            throw error;
        }
    }
    return versions;
}
