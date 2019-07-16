import * as api from 'azure-devops-node-api';
import { IRequestOptions } from 'azure-devops-node-api/interfaces/common/VsoBaseInterfaces';
import * as tl from 'azure-pipelines-task-lib/task';

export function getWebApiWithProxy(serviceUri: string, accessToken: string): api.WebApi {
    const credentialHandler = api.getBasicHandler('vsts', accessToken);
    const options: IRequestOptions = {
        proxy: tl.getHttpProxyConfiguration(serviceUri),
        allowRetries: true,
        maxRetries: 5
    };

    return new api.WebApi(serviceUri, credentialHandler, options);
}

export function getSystemAccessToken(): string {
    tl.debug('Getting credentials for local feeds');
    const auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth.scheme === 'OAuth') {
        tl.debug('Got auth token');
        return auth.parameters['AccessToken'];
    } else {
        tl.warning('Could not determine credentials to use');
    }
}