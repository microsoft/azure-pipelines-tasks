import path = require("path");
import * as api from 'azure-devops-node-api';
import { IRequestOptions } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
import * as tl from 'azure-pipelines-task-lib/task';

tl.setResourcePath(path.join(__dirname, 'module.json'), true);

export function getWebApiWithProxy(serviceUri: string, accessToken: string, options: IRequestOptions = {}): api.WebApi {
    const credentialHandler = api.getBasicHandler('vsts', accessToken);
    const defaultOptions: IRequestOptions = {
        proxy: tl.getHttpProxyConfiguration(serviceUri),
        allowRetries: true,
        maxRetries: 5,
        keepAlive: true
    };

    return new api.WebApi(serviceUri, credentialHandler, {...defaultOptions, ...options});
}

/** Return a masked SystemAccessToken */
export function getSystemAccessToken(): string {
    tl.debug('Getting credentials for local feeds');
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth.scheme === 'OAuth') {
        tl.debug(tl.loc("Info_GotAndMaskAuth"));
        tl.setSecret(auth.parameters['AccessToken']);
        return auth.parameters['AccessToken'];
    } else {
        tl.warning('Could not determine credentials to use');
    }
}

