

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import * as engine from 'artifact-engine/Engine';
import * as providers from 'artifact-engine/Providers';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from "azure-pipelines-tool-lib/tool";

import octo = require('@octokit/rest')

var process = require('process');
var DecompressZip = require('decompress-zip');

export const KUBELOGIN_REPO_OWNER = 'Azure';
export const KUBELOGIN_REPO = 'kubelogin';

const AGENT_TEMP_DIR = 'agent.tempDirectory';

const octokit = new octo.Octokit();

export type Platform =
  | 'darwin-amd64'
  | 'darwin-arm64'
  | 'linux-amd64'
  | 'linux-arm64'
  | 'win-amd64';
  
export interface KubeloginRelease {
  readonly version: string;
  readonly platform: Platform;
  readonly name: string;
  readonly releaseUrl: string;
  readonly checksumUrl: string;
}

export function resolvePlatform(): Platform {
  const platform = process.platform;
  const arch = process.arch;
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
    const v = version.toLowerCase();
    return v === 'latest' || v === '*' || v === '';
}
  
export async function getLatestVersionTag(): Promise<string> {
  const tag_name = await octokit.repos.getLatestRelease({
    owner: KUBELOGIN_REPO_OWNER,
    repo: KUBELOGIN_REPO,
    }).then(response => response.data.tag_name);
  return tag_name;
}

export async function getKubeloginRelease(version: string = 'latest', platform?: Platform): Promise<KubeloginRelease> {
  const origVersion = version;
  if (isLatestVersion(version)) {
    version = await getLatestVersionTag();
  }

  var version = toolLib.cleanVersion(version);
  if(!version) {
      throw new Error(taskLib.loc("Err_NotAValidSemverVersion"));
  }

  if (version[0] != 'v') {
    version = 'v' + version;
  }

  platform = platform || resolvePlatform();

  const releaseName = `kubelogin-${platform}.zip`;
  const sha256 = `${releaseName}.sha256`;
  
  try {
    const response = await octokit.repos.getReleaseByTag({
      owner: KUBELOGIN_REPO_OWNER,
      repo: KUBELOGIN_REPO,
      tag: version
    });
    const releaseUrl: string = response.data.assets.find(asset => { return asset.name.includes(releaseName); })?.browser_download_url || '';
    const sha256Url: string = response.data.assets.find(asset => { return asset.name.includes(sha256); })?.browser_download_url || '';
    
    return {
      version,
      platform,
      name: releaseName,
      releaseUrl: releaseUrl,
      checksumUrl: sha256Url,
    };
  }
  catch(err){
    taskLib.debug(err);
    throw Error(taskLib.loc('Err_VersionNotFound', origVersion));
  }
}

function getKubeloginDownloadPath(): string {
  const tempDir = getTempDirectory();
  const downloadPath = path.join(tempDir, KUBELOGIN_REPO + Date.now());
  if (!fs.existsSync(downloadPath)) {
    fs.mkdirSync(downloadPath);
  }
  return downloadPath;
}

function getTempDirectory(): string {
  return taskLib.getVariable(AGENT_TEMP_DIR) || os.tmpdir();
}

export async function downloadKubeloginRelease(release: KubeloginRelease) {
  return new Promise<string>(async (resolve, reject) => {
    let downloadPath = path.join(getKubeloginDownloadPath(), release.name);

    // We are using public Rest API to download release. Authentication is not need , but we have to create an empty handler
    var customCredentialHandler = {
      canHandleAuthentication: () => false,
      handleAuthentication: () => { },
      prepareRequest: (options: any) => {
      }
    }
    var webProvider = new providers.ZipProvider(release.releaseUrl, customCredentialHandler, { maxRedirects: 5});
    var fileSystemProvider = new providers.FilesystemProvider(downloadPath);

    var downloader = new engine.ArtifactEngine();
    var downloaderOptions = new engine.ArtifactEngineOptions();

    var debugMode = taskLib.getVariable('System.Debug');
    downloaderOptions.verbose = debugMode ? debugMode.toLowerCase() != 'false' : false;

    await downloader.processItems(webProvider, fileSystemProvider, downloaderOptions).then((result) => {
        console.log(taskLib.loc("Info_ToolDownloaded", downloadPath));
        resolve(downloadPath);
    }).catch((error) => {
        console.log(taskLib.loc("Info_DownloadingFailed", downloadPath));
        reject(error);
    });
  });
}

export async function unzipRelease(zipPath: string): Promise<string> {
  if(!taskLib.exist(zipPath)) {
    throw new Error("Path doesn't exist");
  }

  const tempDir = getTempDirectory();
  var unzipPath = path.join(tempDir, KUBELOGIN_REPO + Date.now());

	await new Promise<void>(function (resolve, reject) {
		if (taskLib.exist(unzipPath)) {
			taskLib.rmRF(unzipPath);
		}

		taskLib.debug('Extracting ' + zipPath + ' to ' + unzipPath);

		var unzipper = new DecompressZip(zipPath);
		unzipper.on('error', (err: any) => {
			return reject(taskLib.loc("Err_ExtractionFailed", err))
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
  const files = fs.readdirSync(inputPath);
  for(const file of files) {
    const filePath = path.join(inputPath, file);
    const fileStat = fs.statSync(filePath);

    if (fileStat.isDirectory()) {
      const foundFilePath = getKubeloginPath(filePath, fileName);
      if (foundFilePath) {
        return foundFilePath;
      }
    } else if (fileStat.isFile() && file === fileName) {
      return filePath;
    }
  }
  return undefined;
}
