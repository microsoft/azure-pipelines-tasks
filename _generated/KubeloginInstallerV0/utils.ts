import * as fs from 'fs';
import * as path from 'path';

import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';

import webClient = require('azure-pipelines-tasks-azure-arm-rest/webClient');

var process = require('process');
var packagejson = require('./package.json');

export const KUBELOGIN_REPO_OWNER = 'Azure';
export const KUBELOGIN_REPO = 'kubelogin';

const userAgent: string = 'kubelogin-installer-task-' + packagejson.version;

export type Platform = 'darwin-amd64' | 'darwin-arm64' | 'linux-amd64' | 'linux-arm64' | 'win-amd64';

export interface KubeloginRelease {
  readonly version: string;
  readonly platform: Platform;
  readonly name: string;
  readonly releaseUrl: string;
  readonly checksumUrl: string;
}

export function resolvePlatform(): Platform {
  const platform: string = process.platform;
  const arch: string = process.arch;
  if (platform === 'darwin' && arch === 'x64') {
    return 'darwin-amd64';
  } else if (platform === 'darwin' && arch === 'arm64') {
    return 'darwin-arm64';
  } else if (platform === 'linux' && arch === 'x64') {
    return 'linux-amd64';
  } else if (platform === 'linux' && arch === 'arm64') {
    return 'linux-arm64';
  } else if (platform === 'win32' && arch === 'x64') {
    return 'win-amd64';
  } else {
    throw new Error(`Unsupported platform: ${platform}-${arch}`);
  }
}

export function isLatestVersion(version: string): boolean {
  const v: string = version.toLowerCase();
  return v === 'latest' || v === '*' || v === '';
}

export async function getLatestVersionTag(): Promise<string> {
  let request = new webClient.WebRequest();
  request.uri = 'https://api.github.com/repos/' + KUBELOGIN_REPO_OWNER + '/' + KUBELOGIN_REPO + '/releases/latest';
  request.method = 'GET';
  request.headers = request.headers || {};
  request.headers['User-Agent'] = userAgent;

  const response = await webClient.sendRequest(request);
  return response.body['tag_name'];
}

export async function getKubeloginRelease(version: string = 'latest', platform?: Platform): Promise<KubeloginRelease> {
  const origVersion: string = version;
  if (isLatestVersion(version)) {
    version = await getLatestVersionTag();
  }

  version = toolLib.cleanVersion(version);
  if (!version) {
    throw new Error(taskLib.loc('Err_NotAValidSemverVersion'));
  }

  if (version[0] != 'v') {
    version = 'v' + version;
  }

  platform = platform || resolvePlatform();

  const releaseName: string = `kubelogin-${platform}.zip`;
  const sha256: string = `${releaseName}.sha256`;

  try {
    let request = new webClient.WebRequest();
    request.uri = 'https://api.github.com/repos/' + KUBELOGIN_REPO_OWNER + '/' + KUBELOGIN_REPO + '/releases/tags/' + version;
    request.method = 'GET';
    request.headers = request.headers || {};
    request.headers['User-Agent'] = userAgent;

    const response = await webClient.sendRequest(request);

    const releaseUrl: string =
      response.body['assets'].find(asset => {
        return asset.name.includes(releaseName);
      })?.browser_download_url || '';
    const sha256Url: string =
      response.body['assets'].find(asset => {
        return asset.name.includes(sha256);
      })?.browser_download_url || '';

    return {
      version,
      platform,
      name: releaseName,
      releaseUrl: releaseUrl,
      checksumUrl: sha256Url
    };
  } catch (err) {
    taskLib.debug(err);
    throw Error(taskLib.loc('Err_VersionNotFound', origVersion));
  }
}

export async function downloadKubeloginRelease(release: KubeloginRelease): Promise<string> {
  try {
    const downloadPath = await toolLib.downloadTool(release.releaseUrl);
    console.log(taskLib.loc('Info_ToolDownloaded', downloadPath));
    return downloadPath;
  } catch (exception) {
    throw new Error(taskLib.loc('Info_DownloadingFailed', exception));
  }
}

export async function unzipRelease(zipPath: string): Promise<string> {
  if (!taskLib.exist(zipPath)) {
    throw new Error("Path doesn't exist");
  }

  try {
    const unzipPath: string =  await toolLib.extractZip(zipPath);
    taskLib.debug('Extracted ' + zipPath + ' to ' + unzipPath + ' successfully');
    return unzipPath;
  }
  catch (err) {
    throw new Error(taskLib.loc('Err_ExtractionFailed', err));
  }
}

export function getKubeloginPath(inputPath: string, fileName: string): string | undefined {
  const files: string[] = fs.readdirSync(inputPath);
  for (const file of files) {
    const filePath: string = path.join(inputPath, file);
    const fileStat: fs.Stats = fs.statSync(filePath);

    if (fileStat.isDirectory()) {
      const foundFilePath: string | undefined = getKubeloginPath(filePath, fileName);
      if (foundFilePath) {
        return foundFilePath;
      }
    } else if (fileStat.isFile() && file === fileName) {
      return filePath;
    }
  }
  return undefined;
}
