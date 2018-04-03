import * as os from "os";
import * as path from "path";
import * as toolLib from 'vsts-task-tool-lib/tool';
import * as tl from "vsts-task-lib/task";
import * as downloadutility from "./downloadutility";
import * as util from "util";

var fs = require('fs');

// get a stable version from the url https://storage.googleapis.com/kubernetes-release/release/stable.txt
export async function getStableKubectlVersion() : Promise<string> {
    var stableVersion = "v1.8.9";
    var version;
    var stableVersionUrl = "https://storage.googleapis.com/kubernetes-release/release/stable.txt";
    var downloadPath = path.join(getTempDirectory(), getCurrentTime().toString()+".txt");
    return downloadutility.download(stableVersionUrl, downloadPath).then((resolve) => {
        version = fs.readFileSync(downloadPath, "utf8").toString().trim();
        if(!version){
            version = stableVersion;
        }
        return version;
    },
    (reject) => {
        tl.debug(reject);
        tl.warning(tl.loc('DownloadStableVersionFailed', stableVersionUrl, stableVersion));
        return stableVersion;
    })
}


export async function downloadKubectl(version: string) : Promise<string> {
    var kubectlURL = getkubectlDownloadURL(version);

    var kubectlRelativePath = getKubectlRelativeFilePath(version);
    var kubectlDest = path.join(getTempDirectory(), kubectlRelativePath);
    var kubectlPathTmp = kubectlDest + ".tmp";

    // make sure that the folder exists
    tl.mkdirP(path.dirname(kubectlDest));

    if(fs.existsSync(kubectlDest)) {
        tl.debug(tl.loc('SkippingDownloadKubectl', kubectlDest));
        return kubectlDest;
    }

    tl.debug(tl.loc('DownloadingKubeCtlFromUrl', kubectlURL, kubectlPathTmp));

    try{
        // Download Kubectl to temp file then copy to destination.
        await downloadutility.download(kubectlURL, kubectlPathTmp);
        tl.cp(kubectlPathTmp, kubectlDest, "-f");
        fs.chmod(kubectlDest, "777");
        
        if(fs.existsSync(kubectlDest)) {
            return kubectlDest;
        }
    }
    catch (error) {
        tl.error(error);
        throw new Error(tl.loc('DownloadKubectlFailedFromLocation', kubectlURL));
    }

    throw new Error(tl.loc('DownloadKubectlFailedFromLocation', kubectlURL));
}

function getKubectlRelativeFilePath(version: string) {
    return path.join("Kubectl", version, "kubectl"+getExecutableExtention());
}

function getTempDirectory(): string {
    return tl.getVariable('agent.tempDirectory') || os.tmpdir();
}


function getCurrentTime(): number {
    return new Date().getTime();
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

