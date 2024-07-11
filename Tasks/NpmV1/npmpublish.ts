import * as tl from 'azure-pipelines-task-lib/task';

import { NpmTaskInput, RegistryLocation } from './constants';
import { INpmRegistry, NpmRegistry } from 'azure-pipelines-tasks-packaging-common/npm/npmregistry';
import { NpmToolRunner } from './npmtoolrunner';
import * as util from 'azure-pipelines-tasks-packaging-common/util';
import * as npmutil from 'azure-pipelines-tasks-packaging-common/npm/npmutil';
import * as npmrcparser from 'azure-pipelines-tasks-packaging-common/npm/npmrcparser';
import { getSystemAccessToken, PackagingLocation, getFeedRegistryUrl, RegistryType } from 'azure-pipelines-tasks-packaging-common/locationUtilities';
import * as os from 'os';

export async function run(packagingLocation: PackagingLocation): Promise<void> {
    const workingDir = tl.getInput(NpmTaskInput.WorkingDir) || process.cwd();
    const npmrc = npmutil.getTempNpmrcPath();
    const npmRegistry: INpmRegistry = await getPublishRegistry(packagingLocation);

    tl.debug(tl.loc('PublishRegistry', npmRegistry.url));
    npmutil.appendToNpmrc(npmrc, `registry=${npmRegistry.url}\n`);
    npmutil.appendToNpmrc(npmrc, `${npmRegistry.auth}\n`);

    // For publish, always override their project .npmrc
    const npm = new NpmToolRunner(workingDir, npmrc, true);
    npm.line('publish');

    await npm.exec();

    tl.rmRF(npmrc);
    tl.rmRF(util.getTempPath());
}

/** Return Publish NpmRegistry with masked auth*/
export async function getPublishRegistry(packagingLocation: PackagingLocation): Promise<INpmRegistry> {
    let npmRegistry: INpmRegistry;
    const registryLocation = tl.getInput(NpmTaskInput.PublishRegistry) || null;
    switch (registryLocation) {
        case RegistryLocation.Feed:
            tl.debug(tl.loc('PublishFeed'));
            const feed = util.getProjectAndFeedIdFromInputParam(NpmTaskInput.PublishFeed);
            npmRegistry = await getNpmRegistry(
                packagingLocation.DefaultPackagingUri,
                feed,
                false /* authOnly */,
                true /* useSession */);
            break;
        case RegistryLocation.External:
            tl.debug(tl.loc('PublishExternal'));
            const endpointId = tl.getInput(NpmTaskInput.PublishEndpoint, true);
            npmRegistry = await NpmRegistry.FromServiceEndpoint(endpointId);
            break;
    }
    return npmRegistry;
}

/** Return NpmRegistry with masked auth*/
async function getNpmRegistry(defaultPackagingUri: string, feed: any, authOnly?: boolean, useSession?: boolean) {
    const lineEnd = os.EOL;
    let url: string;
    let nerfed: string;
    let auth: string;
    let username: string;
    let email: string;
    let password64: string;

    url = npmrcparser.NormalizeRegistry(await getFeedRegistryUrl(defaultPackagingUri, RegistryType.npm, feed.feedId, feed.projectId, null, useSession));
    nerfed = util.toNerfDart(url);

    // Setting up auth info
    const accessToken = getAccessToken();

    // Azure DevOps does not support PATs+Bearer only JWTs+Bearer
    email = 'VssEmail';
    username = 'VssToken';
    password64 = Buffer.from(accessToken).toString('base64');
    tl.setSecret(password64);

    auth = nerfed + ':username=' + username + lineEnd;
    auth += nerfed + ':_password=' + password64 + lineEnd;
    auth += nerfed + ':email=' + email + lineEnd;

    return new NpmRegistry(url, auth, authOnly);
}

/** Return a masked AccessToken */
function getAccessToken(): string {
    let accessToken: string;
    let allowServiceConnection = tl.getVariable('PUBLISH_VIA_SERVICE_CONNECTION');

    if (allowServiceConnection) {
        let endpoint = tl.getInput('publishEndpoint', false);

        if (endpoint) {
            tl.debug("Found external endpoint, will use token for auth");
            let endpointAuth = tl.getEndpointAuthorization(endpoint, true);
            let endpointScheme = tl.getEndpointAuthorizationScheme(endpoint, true).toLowerCase();
            switch (endpointScheme) {
                case ("token"):
                    accessToken = endpointAuth.parameters["apitoken"];
                    break;
                default:
                    tl.warning(tl.loc("UnsupportedServiceConnectionAuth"));
                    break;
            }
        }
        if (!accessToken) {
            tl.debug('Defaulting to use the System Access Token.');
            accessToken = getSystemAccessToken();
        }
    }
    else {
        accessToken = getSystemAccessToken();
    }
    tl.setSecret(accessToken);
    return accessToken;
}