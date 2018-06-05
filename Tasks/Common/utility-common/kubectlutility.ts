import * as os from "os";
import * as path from "path";
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as tl from "vsts-task-lib/task";
import * as downloadutility from "./downloadutility";
import * as util from "util";
const uuidV4 = require('uuid/v4');
const kubectlToolName = "kubectl"
export const stableKubectlVersion = "v1.8.9"
var Base64 = require('js-base64').Base64;


var fs = require('fs');

// get a stable version from the url https://storage.googleapis.com/kubernetes-release/release/stable.txt
export async function getStableKubectlVersion() : Promise<string> {
    var version;
    var stableVersionUrl = "https://storage.googleapis.com/kubernetes-release/release/stable.txt";
    var downloadPath = path.join(getTempDirectory(), uuidV4() +".txt");
    return downloadutility.download(stableVersionUrl, downloadPath, false).then((resolve) => {
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
    var kubectlURL = getkubectlDownloadURL(version);
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
    fs.chmod(kubectlPath, "777");
    return kubectlPath;
}

export function createKubeconfig(kubernetesServiceEndpoint: string): string
{
    var kubeconfigTemplateString = '{"apiVersion":"v1","kind":"Config","clusters":[{"cluster":{"certificate-authority-data": null,"server": null}}], "users":[{"user":{"token": null}}]}';
    var kubeconfigTemplate = JSON.parse(kubeconfigTemplateString);

    //populate server url, ca cert and token fields
    kubeconfigTemplate.clusters[0].cluster.server = tl.getEndpointUrl(kubernetesServiceEndpoint, false);
    kubeconfigTemplate.clusters[0].cluster["certificate-authority-data"] = tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'serviceAccountCertificate', false);
    kubeconfigTemplate.users[0].user.token = Base64.decode(tl.getEndpointAuthorizationParameter(kubernetesServiceEndpoint, 'apiToken', false));

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

function getExecutableExtention(): string {
    if(os.type().match(/^Win/)){
        return ".exe";
    }

    return "";
}