import tl = require('azure-pipelines-task-lib/task');
import path from 'path';
import { isLatestVersion, getLatestVersionTag, getKubeloginRelease, downloadKubeloginRelease, unzipRelease, getKubeloginPath, KubeloginRelease, Platform } from './utils';

async function run() {
    try {
        let kubeloginVersion: string = tl.getInput('kubeloginVersion') || '';

        if (isLatestVersion(kubeloginVersion))
        {
            kubeloginVersion = await getLatestVersionTag();
        }

        let kubeloginRelease: KubeloginRelease = await getKubeloginRelease(kubeloginVersion);
        
        console.log('Kubelogin release:     ', kubeloginRelease.name);
        console.log('Kubelogin platform:    ', kubeloginRelease.platform);
        console.log('Kubelogin version:     ', kubeloginRelease.version);
        console.log('Kubelogin release URL: ', kubeloginRelease.releaseUrl);

        var zipPath = await downloadKubeloginRelease(kubeloginRelease);
        var unzipPath = await unzipRelease(zipPath);
        
        const fileName = kubeloginRelease.platform == 'win-amd64' ? 'kubelogin.exe' : 'kubelogin';
        const filePath = getKubeloginPath(unzipPath, fileName);
        if(filePath == undefined) {
            tl.error('kubelogin was not found.')
            return;
        }
        
        tl.prependPath(path.dirname(filePath));
        tl.setVariable("directoryName", path.dirname(filePath), false, true);
        tl.setVariable("fullName", filePath, false, true);
    }
    catch (err: any) {
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

run()
    .then(() => tl.setResult(tl.TaskResult.Succeeded, ""))
    .catch((error) => tl.setResult(tl.TaskResult.Failed, !!error.message ? error.message : error));