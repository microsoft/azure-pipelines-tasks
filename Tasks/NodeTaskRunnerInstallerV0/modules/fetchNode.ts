import * as os from 'os';
import * as taskLib from 'azure-pipelines-task-lib/task';
import * as toolLib from 'azure-pipelines-tool-lib/tool';
import * as restc from 'typed-rest-client/RestClient';
import * as ifm from 'typed-rest-client/Interfaces';
import { INodeVersion } from '../models/INodeVersion';
import { getSupportedNodeVersions } from './getSupportedNodeVersions';

const osPlatform: string = os.platform();

export function getDownloadUrl(version: string, installedArch: string) {
    const fileName: string =
        osPlatform === 'win32' ?
            'node-v' + version + '-win-' + installedArch :
            'node-v' + version + '-' + osPlatform + '-' + installedArch;

    const urlFileName: string =
        osPlatform === 'win32' ?
            fileName + '.7z' :
            fileName + '.tar.gz';

    const downloadUrl = 'https://nodejs.org/dist/v' + version + '/' + urlFileName;

    return downloadUrl;
}

/**
 * Get node lates version which matches with input non-explicit version
 **/
export async function fetchLatestMatchNodeVersion(versionSpec: string, installedArch: string): Promise<string | undefined> {

    const nodeVersionsUrl = 'https://nodejs.org/dist/index.json';

    const proxyRequestOptions: ifm.IRequestOptions = {
        proxy: taskLib.getHttpProxyConfiguration(nodeVersionsUrl),
        cert: taskLib.getHttpCertConfiguration(),
        ignoreSslError: !!taskLib.getVariable('Agent.SkipCertValidation')
    };

    const rest: restc.RestClient = new restc.RestClient('vsts-node-tool', undefined, undefined, proxyRequestOptions);

    const nodeVersions: INodeVersion[] = (await rest.get<INodeVersion[]>(nodeVersionsUrl)).result;

    const dataFileName = getDataFileName(osPlatform, installedArch);

    const supportedVersions = getSupportedNodeVersions(nodeVersions, dataFileName);

    // get the latest version that matches the version spec
    const latestVersion: string = toolLib.evaluateVersions(supportedVersions, versionSpec);
    // In case if that we had not found version that match
    if (!latestVersion) { return undefined; }

    return nodeVersions.find(v => v.semanticVersion === latestVersion)?.version;
}

function getDataFileName(osPlat: string, installedArch: string) {
    // node offers a json list of versions
    switch (osPlat) {
        case 'linux': return 'linux-' + installedArch;

        case 'darwin': return 'osx-' + installedArch + '-tar';

        case 'win32': return 'win-' + installedArch + '-exe';

        default: throw new Error(taskLib.loc('UnexpectedOS', osPlat));
    }
}
