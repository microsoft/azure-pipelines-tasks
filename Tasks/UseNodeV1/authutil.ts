import * as taskLib from 'vsts-task-lib/task';
import * as locationUtil from 'packaging-common/locationUtilities';
import { NormalizeRegistry } from 'packaging-common/npm/npmrcparser';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import * as url from 'url';

function setNpmrc(registryUrl: string, registryToken: string, authFile?: string) {
    let projectNpmrc: string = path.resolve(process.cwd(), '.npmrc');
    if (authFile) {
        projectNpmrc = path.resolve(process.cwd(), authFile);
    }

    let newContents = '';
    if (fs.existsSync(projectNpmrc)) {
        const curContents = fs.readFileSync(projectNpmrc, 'utf8');
        curContents.split(os.EOL).forEach((line) => {
            // Add current contents unless they are setting the registry
            if (!line.startsWith('registry')) {
                newContents += line + os.EOL;
            }
        });
    }
    newContents += 'registry=' + registryUrl + os.EOL + 'always-auth=true' + os.EOL + registryUrl + ':_authToken=${NPM_TOKEN}';
    fs.writeFileSync(projectNpmrc, newContents);

    taskLib.setVariable('NPM_TOKEN', registryToken, true);
}

export async function setAuth(auth: string, authFile?: string) {
    let packagingLocation: locationUtil.PackagingLocation;
    try {
        packagingLocation = await locationUtil.getPackagingUris(locationUtil.ProtocolType.Npm);
    } catch (error) {
        taskLib.debug('Unable to get packaging URIs, using default collection URI');
        taskLib.debug(JSON.stringify(error));
        const collectionUrl = taskLib.getVariable('System.TeamFoundationCollectionUri');
        packagingLocation = {
            PackagingUris: [collectionUrl],
            DefaultPackagingUri: collectionUrl
        };
    }
    const uri = NormalizeRegistry(await locationUtil.getFeedRegistryUrl(packagingLocation.DefaultPackagingUri, locationUtil.RegistryType.npm, auth, null, null));

    // Nerf url
    let parsed = url.parse(uri);
    delete parsed.protocol;
    delete parsed.auth;
    delete parsed.query;
    delete parsed.search;
    delete parsed.hash;
    const nerfed = url.resolve(url.format(parsed), '.');

    const token = locationUtil.getSystemAccessToken();

    setNpmrc(nerfed, token, authFile);
}