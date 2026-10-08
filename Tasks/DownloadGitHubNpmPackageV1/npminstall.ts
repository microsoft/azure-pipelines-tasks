import * as path from 'path';

import * as tl from 'azure-pipelines-task-lib/task';
import * as npmutil from 'azure-pipelines-tasks-packaging-common/npm/npmutil';
import * as httpClient from 'typed-rest-client/HttpClient';
import {
    getValidatedNpmPackageSpec,
    setNpmArguments,
} from './npmarguments';

import { NpmToolRunner } from './npmtoolrunner';

export async function run(): Promise<void> {
    let npmrc: string | undefined = undefined;

    try {
        npmrc = npmutil.getTempNpmrcPath();
        let owner: string = "";
        let token: string = "";

        const endpointName = tl.getInputRequired("externalEndpoints");

        if (!endpointName) {
            tl.error("Couldn't find the specified service connection.");
            tl.setResult(tl.TaskResult.Failed, tl.loc('PackageFailedToInstall'));
        }

        let packageNameInput = tl.getInputRequired("packageName");
        let packageVersion = tl.getInputRequired("version");
        const isArgumentIsolationFixEnabled
            = tl.getPipelineFeature('DownloadGithubNpmPackageV1ArgumentIsolationFixEnabled');

        if (!packageNameInput || packageNameInput.indexOf("/") < 0) {
            throw Error(tl.loc('Error_InvalidPackageName'));
        } else {
            packageNameInput = packageNameInput.split("/")[1];
        }

        owner = await GetGitHubUser(endpointName); // we will always have a single connection
        token = getEndpointAuthData(endpointName);

        if (token) {
            tl.setSecret(token);
        }

        let packageName = owner.toLowerCase() + "/" + packageNameInput.toLowerCase();
        if (isArgumentIsolationFixEnabled) {
            getValidatedNpmPackageSpec(packageName, packageVersion);
        }

        const url = "https://npm.pkg.github.com/" + owner;
        let authDetails = "//npm.pkg.github.com/:_authToken=" + token;
        tl.debug(tl.loc('UsingRegistry', url));
        tl.mkdirP

        npmutil.appendToNpmrc(npmrc, `registry=${url}\n`);
        npmutil.appendToNpmrc(npmrc, `${authDetails}\n`);

        const packageDownloadPath = getProjectPath(packageNameInput);
        const npm = new NpmToolRunner(path.dirname(npmrc), npmrc, false);
        setNpmArguments(
            npm,
            packageDownloadPath,
            packageName,
            packageVersion,
            isArgumentIsolationFixEnabled
        );

        npm.execSync();
    } catch (err) {
        tl.setResult(tl.TaskResult.Failed, "Some error occurred:" + err);
    } finally {
        if (npmrc && tl.exist(npmrc)) {
            tl.rmRF(npmrc);
        }
    }
}

export function getProjectPath(packageName: string): string {
    const tempNpmrcDir
        = tl.getVariable('Agent.BuildDirectory')
        || tl.getVariable('Agent.TempDirectory');

    const tempPath = path.join(tempNpmrcDir!, packageName);

    if (tl.exist(tempPath) === false) {
        tl.mkdirP(tempPath);
    }

    return tempPath;
}

async function GetGitHubUser(endpointId: string): Promise<string> {
    let externalAuth = tl.getEndpointAuthorization(endpointId, true);
    let scheme = tl.getEndpointAuthorizationScheme(endpointId, true)?.toLowerCase();

    if (!(scheme == "token" || scheme == "personalaccesstoken")) {
        return "";
    }

    let token = "";
    if (scheme == "token") {
        token = externalAuth?.parameters["AccessToken"] ?? "";
    } else if (scheme == "personalaccesstoken") {
        token = externalAuth?.parameters["accessToken"] ?? "";
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
    let scheme = tl.getEndpointAuthorizationScheme(endpointName, true)?.toLowerCase();
    let token = "";

    switch (scheme) {
        case "token":
            token = externalAuth?.parameters["AccessToken"] ?? "";
            break;
        case "personalaccesstoken":
            token = externalAuth?.parameters["accessToken"] ?? "";
            break;
        case "usernamepassword":
        case "none":
            break;
        default:
            break;
    }

    return token;
}