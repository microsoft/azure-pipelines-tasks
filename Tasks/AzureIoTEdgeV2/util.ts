import Constants from "./constant";
import * as tl from "azure-pipelines-task-lib/task";
import * as crypto from "crypto";
import { IExecSyncOptions } from 'azure-pipelines-task-lib/toolrunner';
import { Writable } from "stream";
import { RegistryCredential } from './registrycredentialfactory';

interface Cmd {
  path: string;
  arg: string;
  execOption: IExecSyncOptions;
}

export default class Util {
  public static expandEnv(input: string, ...exceptKeys: string[]): string {
    const pattern: RegExp = new RegExp(/\$([a-zA-Z0-9_]+)|\${([a-zA-Z0-9_]+)}/g);
    const exceptSet: Set<string> = new Set(exceptKeys);
    return input.replace(pattern, (matched) => {
      if (exceptKeys && exceptSet.has(matched)) {
        return matched;
      }
      const key: string = matched.replace(/\$|{|}/g, "");
      return process.env[key] || matched;
    });
  }

  public static generateSasToken(resourceUri: string, signingKey: string, policyName: string, expiresInMins: number = 3600) {
    resourceUri = encodeURIComponent(resourceUri);

    // Set expiration in seconds
    var expires = (Date.now() / 1000) + expiresInMins * 60;
    expires = Math.ceil(expires);
    var toSign = resourceUri + '\n' + expires;

    // Use crypto
    var hmac = crypto.createHmac('sha256', new Buffer(signingKey, 'base64'));
    hmac.update(toSign);
    var base64UriEncoded = encodeURIComponent(hmac.digest('base64'));

    // Construct autorization string
    var token = "SharedAccessSignature sr=" + resourceUri + "&sig=" +
      base64UriEncoded + "&se=" + expires;
    if (policyName) token += "&skn=" + policyName;
    return token;
  }

  public static findFiles(filepath: string): string[] {
    if (filepath.indexOf('*') >= 0 || filepath.indexOf('?') >= 0) {
      var buildFolder = tl.cwd();
      var allFiles = tl.find(buildFolder);
      var matchingResultsFiles = tl.match(allFiles, filepath, buildFolder, {
        matchBase: true
      });

      return matchingResultsFiles;
    } else {
      return [filepath];
    }
  }

  public static getModulesContent(templateObject: any): any {
    if (templateObject.modulesContent != undefined) {
      return templateObject.modulesContent;
    }
    if (templateObject.moduleContent != undefined) {
      return templateObject.moduleContent;
    }
    throw Error(`Property moduleContent or modulesContent can't be found in template`);
  }

  public static setupIotedgedev(): void {
    try {
      let result = tl.execSync(`${Constants.iotedgedev}`, `--version`, Constants.execSyncSilentOption);
      if (result.code === 0) {
        console.log(tl.loc('DependencyAlreadyInstalled', Constants.iotedgedev, result.stdout.substring(result.stdout.indexOf("version"))));
        return;
      }
    } catch (e) {
      // If exception, it means iotedgedev is not installed. Do nothing.
    }

    let cmds: Cmd[] = [];
    let version = Constants.iotedgedevDefaultVersion;
    if (tl.getVariable(Constants.iotedgedevLockVersionKey)) {
      version = tl.getVariable(Constants.iotedgedevLockVersionKey);
    }
    tl.debug(`The specified iotedgedev version is: ${version}`);
    if (tl.osType() === Constants.osTypeLinux) {
      cmds = [
        { path: `sudo`, arg: `apt-get update`, execOption: Constants.execSyncSilentOption },
        { path: `sudo`, arg: `apt-get install -y python-setuptools`, execOption: Constants.execSyncSilentOption },
        { path: `sudo`, arg: `pip install ${Constants.iotedgedev}==${version}`, execOption: Constants.execSyncSilentOption },
      ]
    } else if (tl.osType() === Constants.osTypeWindows) {
      cmds = [
        { path: `pip`, arg: `install ${Constants.iotedgedev}==${version}`, execOption: Constants.execSyncSilentOption },
      ]
    }

    try {
      for (let cmd of cmds) {
        let result = tl.execSync(cmd.path, cmd.arg, cmd.execOption);
        if (result.code !== 0) {
          tl.debug(result.stderr);
        }
      }
    } catch (e) {
      // If exception, record error message to debug
      tl.debug(e);
    }

    let result = tl.execSync(`${Constants.iotedgedev}`, `--version`, Constants.execSyncSilentOption);
    if (result.code === 0) {
      console.log(tl.loc('DependencyInstallSuccess', Constants.iotedgedev, result.stdout.substring(result.stdout.indexOf("version"))));
    } else {
      throw Error(tl.loc('DependencyInstallFail', Constants.iotedgedev));
    }
  }

  public static debugOsType() {
    let cmd: string[] = null;
    if (tl.osType() === Constants.osTypeWindows) {
      cmd = ['systeminfo', null];
    } else if (tl.osType() === Constants.osTypeLinux) {
      cmd = [`lsb_release`, `-a`];
    }
    if (cmd != null) {
      try {
        let result = tl.execSync(cmd[0], cmd[1], Constants.execSyncSilentOption);
        tl.debug(`OS is ${result.stdout}`);
      } catch (e) {
        tl.debug(`Error happened when fetching os info: ${e.message}`);
      }
    }
  }

  // test
  // a b false
  // docker.io docker.io true
  // "docker.io","http://index.docker.io/v1" true
  // "zhiqing.azurecr.io","http://zhiqing.azurecr.io" true
  // "zhiqing.azurecr.io","https://zhiqing.azurecr.io" true
  // "zhiqing.azurecr.io","https://zhiqing.azurecr.io/" true
  public static isDockerServerMatch(a: string, b: string): boolean {
    if (a === b) return true;
    if (a.includes(Constants.defaultDockerHubHostname) && b.includes(Constants.defaultDockerHubHostname)) return true;

    let reg = new RegExp(/^(?:https?:\/\/)?(.*?)\/?$/);
    let aMatch = reg.exec(a);
    let bMatch = reg.exec(b);
    if (aMatch == null || bMatch == null) return false;
    return aMatch[1] === bMatch[1];
  }

  // Check if self(task) is included in a build pipeline
  public static checkSelfInBuildPipeline(): boolean {
    let hostType = tl.getVariable('system.hostType').toLowerCase();
    // Set to build if the pipeline is a build. For a release, the values are deployment for a Deployment group job and release for an Agent job.
    return hostType === 'build';
  }

  public static createOrAppendDockerCredentials(registryAuthenticationToken: RegistryCredential): void {
    let creVar = tl.getVariable(Constants.fileNameDockerCredential);

    let credentials = creVar ? JSON.parse(creVar) : [];
    if (registryAuthenticationToken) {
      credentials.push({
        username: registryAuthenticationToken.username,
        password: registryAuthenticationToken.password,
        address: registryAuthenticationToken.serverUrl
      });
    }
    tl.setVariable(Constants.fileNameDockerCredential, JSON.stringify(credentials));
  }

  public static readDockerCredentials(): any[] {
    let creVar = tl.getVariable(Constants.fileNameDockerCredential);

    let credentials = creVar ? JSON.parse(creVar) : [];
    return credentials;
  }

  public static sha256(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  public static setTaskRootPath(root: string): void {
    try {
      tl.pushd(root);
      tl.debug(`Task root path set to ${root}`);
    } catch (e) {
      console.log(tl.loc('RootPathNotExist', root));
      tl.setResult(tl.TaskResult.Failed, `The Root path ${root} does not exist.`);
    }
  }

  public static async streamToString(stream: Writable): Promise<string> {
    const chunks = [];
    return new Promise<string>((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    });
  }

  public static normalizeDeploymentId(id: string): string {
    if(id.length > 128) {
      id = id.substring(0, 128);
    }
    id = id.toLowerCase();
    let specialCharRegex = /[^a-z0-9\-:\+%_#\*\?!(),=@;']/g;
    id = id.replace(specialCharRegex, '');
    return id;
  }

  // Check if self(task) is in hosted server
  public static checkSelfInHostedServer(): boolean {
    let serverType = tl.getVariable('System.ServerType').toLowerCase();
    if (!serverType || serverType.toLowerCase() !== 'hosted') {
      return false;
    }
    return true;
  }
}