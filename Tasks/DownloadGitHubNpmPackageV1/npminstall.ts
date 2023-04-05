import * as tl from 'azure-pipelines-task-lib/task';

import { NpmToolRunner } from './npmtoolrunner';
import * as util from 'azure-pipelines-tasks-packaging-common/util';
import * as npmutil from 'azure-pipelines-tasks-packaging-common/npm/npmutil';
import * as path from 'path';
import * as httpClient from 'typed-rest-client/HttpClient';

export async function run(): Promise<void> {
    try {
        const npmrc = npmutil.getTempNpmrcPath();
        let owner: string = "";
        let token: string = "";

        const endpointName = tl.getInput("externalEndpoints");
        if (!endpointName) {
            tl.error("Couldn't find the specified service connection.");
            tl.setResult(tl.TaskResult.Failed, tl.loc('PackageFailedToInstall'));
        }

        let packageNameInput: string = tl.getInput("packageName");
        let packageVersion: string = tl.getInput("version") || "";

        if (!packageNameInput || packageNameInput.indexOf("/") < 0)
        {
            throw Error(tl.loc('Error_InvalidPackageName'));
        }
        else {
            packageNameInput = packageNameInput.split("/")[1];
        }

        owner = await GetGitHubUser(endpointName); // we will always have a single connection
        token = getEndpointAuthData(endpointName);

        const url = "https://npm.pkg.github.com/" + owner;
        let authDetails = "//npm.pkg.github.com/:_authToken=" + token;
        tl.debug(tl.loc('UsingRegistry', url));
        tl.mkdirP

        npmutil.appendToNpmrc(npmrc, `registry=${url}\n`);
        npmutil.appendToNpmrc(npmrc, `${authDetails}\n`);

        const packageDownloadPath = getProjectPath(packageNameInput);

        const npm = new NpmToolRunner(path.dirname(npmrc), npmrc, false);        
        let packageName = owner.toLowerCase() + "/" + packageNameInput.toLowerCase();
        let command: string = "";
        if (packageVersion == "" || packageVersion == undefined) {
            command = "install --prefix " + packageDownloadPath + " @" + packageName;
        } else {
            command = "install --prefix " + packageDownloadPath + " @" + packageName + "@" + packageVersion;
        }

        npm.line(command);
        npm.execSync();

        tl.rmRF(npmrc);
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, "Some error occurred:" + err);
    }
}

export function getProjectPath(packageName: string): string {
    const tempNpmrcDir
        = tl.getVariable('Agent.BuildDirectory')
        || tl.getVariable('Agent.TempDirectory');
        const tempPath = path.join(tempNpmrcDir, packageName);
    if (tl.exist(tempPath) === false) {
        tl.mkdirP(tempPath);
    }

    return tempPath;
}

function createProjectFile(projectDirectory: string, owner: string): string {
    let version: string = tl.getInput("version");
    let packageNameInput : string = tl.getInput("packageName");
    let packageName = owner.toLowerCase() + "/" + packageNameInput.split('/')[1].toLowerCase();
    let projectFile: string  = `
{
    "name": "testProject",
    "version": "${version}",
    "main": "index.js",
    "author": "",
    "license": "MIT",
    "dependencies": {
        "@${packageName}": "${version}"
    }
}`

    tl.writeFile(path.join(projectDirectory, "package.json"), projectFile);
    console.log("npmrc = " + path.join(projectDirectory, "package.json"));
    return path.join(projectDirectory, "package.json");
}

async function GetGitHubUser(endpointId: string): Promise<string> {
    let externalAuth = tl.getEndpointAuthorization(endpointId, true);
    let scheme = tl.getEndpointAuthorizationScheme(endpointId, true).toLowerCase();

    if (!(scheme == "token" || scheme == "personalaccesstoken")) {
        return "";
    }

    let token = "";
    if (scheme == "token") {
        token = externalAuth.parameters["AccessToken"];
    } else if (scheme == "personalaccesstoken") {
        token = externalAuth.parameters["accessToken"];
    }

    const http = new httpClient.HttpClient('typed-test-client');

    let res = await http.get("https://api.github.com/user", {
        "Authorization": "Token " + token,
        "User-Agent": "azure-pipelines"
    });

    let body = await res.readBody();
    let json: { login: string } = JSON.parse(body);

    return json.login;
}

function getEndpointAuthData(endpointName: string): string {
    let externalAuth = tl.getEndpointAuthorization(endpointName, true);
    let scheme = tl.getEndpointAuthorizationScheme(endpointName, true).toLowerCase();
    let token = "";
    switch(scheme) {
        case "token":
            token = externalAuth.parameters["AccessToken"];
            break;
        case "personalaccesstoken":
            token = externalAuth.parameters["accessToken"];                
            break;
        case "usernamepassword":
        case "none":
            break;
        default:
            break;
    }

    return token;
}