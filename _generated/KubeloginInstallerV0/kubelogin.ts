'use strict';

import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as path from 'path';

import { isLatestVersion, getLatestVersionTag, getKubeloginRelease, downloadKubeloginRelease, unzipRelease, getKubeloginPath, KubeloginRelease } from './utils';

const TOOL_NAME: string = 'Kubelogin';
taskLib.setResourcePath(path.join(__dirname, 'task.json'));

async function run() {
  let kubeloginVersion: string = taskLib.getInput('kubeloginVersion') || '';

  const isLatest: boolean = isLatestVersion(kubeloginVersion);
  if (isLatest) {
    kubeloginVersion = await getLatestVersionTag();
  }

  const kubeloginRelease: KubeloginRelease = await getKubeloginRelease(kubeloginVersion);

  console.log(taskLib.loc('Info_KubeloginRelease', kubeloginRelease.name));
  console.log(taskLib.loc('Info_KubeloginPlatform', kubeloginRelease.platform));
  console.log(taskLib.loc('Info_KubeloginVersion', kubeloginRelease.version));
  console.log(taskLib.loc('Info_KubeloginReleaseURL', kubeloginRelease.releaseUrl));

  taskLib.debug('Trying to get tool from local cache first');
  let toolPath: string = toolLib.findLocalTool(TOOL_NAME, kubeloginRelease.version);

  if (toolPath) {
    toolPath = path.join(toolPath, kubeloginRelease.name);
    console.log(taskLib.loc('Info_ResolvedToolFromCache', kubeloginRelease.version));
  } else {
    console.log(taskLib.loc('Info_KubeloginDownloading'));
    toolPath = await downloadKubeloginRelease(kubeloginRelease);
    console.log(taskLib.loc('Info_CachingTool', kubeloginRelease.version));
    toolLib.cacheFile(toolPath, kubeloginRelease.name, TOOL_NAME, kubeloginRelease.version);
  }

  const unzipPath: string = await unzipRelease(toolPath);

  const fileName: string = kubeloginRelease.platform == 'win-amd64' ? 'kubelogin.exe' : 'kubelogin';
  const filePath: string = getKubeloginPath(unzipPath, fileName);
  if (filePath == undefined) {
    console.log(taskLib.loc('Err_VersionNotFound', kubeloginRelease.version));
    taskLib.error('kubelogin was not found.');
    return;
  }

  toolLib.prependPath(path.dirname(filePath));
}

async function verifyKubelogin() {
  console.log(taskLib.loc('Info_VerifyKubeloginInstallation'));
  const kubectlToolPath: string = taskLib.which('kubelogin', true);
  const kubectlTool = taskLib.tool(kubectlToolPath);
  kubectlTool.arg('--help');
  return kubectlTool.exec();
}

run()
  .then(() => verifyKubelogin())
  .then(() => taskLib.setResult(taskLib.TaskResult.Succeeded, taskLib.loc('SucceedMsg')))
  .catch(error => taskLib.setResult(taskLib.TaskResult.Failed, !!error.message ? error.message : error));
