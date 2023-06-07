import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';

import webClient = require('azure-pipelines-tasks-azure-arm-rest-v2/webClient');

var process = require('process');
var DecompressZip = require('decompress-zip');
var packagejson = require('./package.json');

export const KUBELOGIN_REPO_OWNER = 'Azure';
export const KUBELOGIN_REPO = 'kubelogin';

const userAgent: string = 'kubelogin-installer-task-' + packagejson.version;

const AGENT_TEMP_DIR = 'agent.tempDirectory';


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
  var request = new webClient.WebRequest();
  request.uri = 'https://api.github.com/repos/'+ KUBELOGIN_REPO_OWNER + '/' + KUBELOGIN_REPO + '/releases/latest';
  request.method = "GET";  
  request.headers = request.headers || {};
  request.headers["User-Agent"] = userAgent;

  var response = await webClient.sendRequest(request);
  return response.body["tag_name"];
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
    var request = new webClient.WebRequest();
    request.uri = 'https://api.github.com/repos/'+ KUBELOGIN_REPO_OWNER + '/' + KUBELOGIN_REPO + '/releases/tags/' + version;
    request.method = "GET";  
    request.headers = request.headers || {};
    request.headers["User-Agent"] = userAgent;

    var response = await webClient.sendRequest(request);

    const releaseUrl: string =
      response.body["assets"].find(asset => {
        return asset.name.includes(releaseName);
      })?.browser_download_url || '';
    const sha256Url: string =
      response.body["assets"].find(asset => {
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

function getKubeloginDownloadPath(): string {
  const tempDir: string = getTempDirectory();
  const downloadPath: string = path.join(tempDir, KUBELOGIN_REPO + Date.now());
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath);
  }
  return downloadPath;
}

function getTempDirectory(): string {
  return taskLib.getVariable(AGENT_TEMP_DIR) || os.tmpdir();
}

export async function downloadKubeloginRelease(release: KubeloginRelease) {
  const downloadPath: string = path.join(getKubeloginDownloadPath(), release.name);
  try {
    await toolLib.downloadTool(release.releaseUrl, downloadPath);
  }
  catch (exception) {
    throw new Error(taskLib.loc('Info_DownloadingFailed', downloadPath, exception));
  }
  console.log(taskLib.loc('Info_DownloadingFailed', downloadPath));
  return downloadPath;
}

export async function unzipRelease(zipPath: string): Promise<string> {
  if (!taskLib.exist(zipPath)) {
    throw new Error("Path doesn't exist");
  }

  const tempDir: string = getTempDirectory();
  const unzipPath: string = path.join(tempDir, KUBELOGIN_REPO + Date.now());

  await new Promise<void>(function (resolve, reject) {
    if (taskLib.exist(unzipPath)) {
      taskLib.rmRF(unzipPath);
    }

    taskLib.debug('Extracting ' + zipPath + ' to ' + unzipPath);

    var unzipper = new DecompressZip(zipPath);
    unzipper.on('error', (err: any) => {
      return reject(taskLib.loc('Err_ExtractionFailed', err));
    });
    unzipper.on('extract', () => {
      taskLib.debug('Extracted ' + zipPath + ' to ' + unzipPath + ' successfully');
      return resolve();
    });

    unzipper.extract({
      path: path.normalize(unzipPath)
    });
  });
  return unzipPath;
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
