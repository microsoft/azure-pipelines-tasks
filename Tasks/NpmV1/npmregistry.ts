import * as tl from 'azure-pipelines-task-lib/task';
import * as os from 'os';
import { toNerfDart, normalizeRegistry } from './npmutils';
import { getFeedRegistryUrl, getSystemAccessToken, RegistryType } from 'azure-pipelines-tasks-packaging-common/locationUtilities';

export interface INpmRegistry {
    url: string;
    auth: string;
    authOnly?: boolean;
}

export class NpmRegistry implements INpmRegistry {
    public url: string;
    public auth: string;
    public authOnly: boolean;

    constructor(url: string, auth: string, authOnly?: boolean) {
        this.url = url;
        this.auth = auth;
        this.authOnly = authOnly || false;
    }

    // Uses bearer auth (_authToken) via the pipeline's system access token
    public static async FromFeedId(
        packagingUri: string,
        feedId: string,
        project?: string,
        authOnly?: boolean,
        useSession?: boolean
    ): Promise<NpmRegistry> {
        const url = normalizeRegistry(
            await getFeedRegistryUrl(packagingUri, RegistryType.npm, feedId, project, null, useSession));
        return NpmRegistry.FromUrl(url, authOnly);
    }

    public static FromUrl(url: string, authOnly?: boolean): NpmRegistry {
        const nerfed = toNerfDart(url);
        const auth = `${nerfed}:_authToken=${getSystemAccessToken()}`;
        return new NpmRegistry(url, auth, authOnly);
    }

    public static async FromServiceEndpoint(
        endpointId: string,
        authOnly?: boolean
    ): Promise<NpmRegistry> {
        const lineEnd = os.EOL;

        let endpointAuth: tl.EndpointAuthorization;
        try {
            endpointAuth = tl.getEndpointAuthorization(endpointId, false);
        } catch {
            throw new Error(tl.loc('ServiceEndpointNotDefined'));
        }

        let url: string;
        try {
            url = normalizeRegistry(tl.getEndpointUrl(endpointId, false));
        } catch {
            throw new Error(tl.loc('ServiceEndpointUrlNotDefined'));
        }

        const nerfed = toNerfDart(url);
        let auth: string;
        let username: string;
        let password: string;
        let email: string;
        let password64: string;

        const isVstsTokenAuth = endpointAuth.scheme === 'Token'
            ? await isEndpointInternal(url)
            : false;

        switch (endpointAuth.scheme) {
            case 'UsernamePassword':
                username = endpointAuth.parameters['username'];
                password = endpointAuth.parameters['password'];
                email = username; // npm needs an email to publish; this is ignored on npmjs
                password64 = Buffer.from(password).toString('base64');

                auth = nerfed + ':username=' + username + lineEnd;
                auth += nerfed + ':_password=' + password64 + lineEnd;
                auth += nerfed + ':email=' + email + lineEnd;
                break;
            case 'Token':
                const apitoken = endpointAuth.parameters['apitoken'];
                tl.setSecret(apitoken);
                if (!isVstsTokenAuth) {
                    auth = nerfed + ':_authToken=' + apitoken + lineEnd;
                } else {
                    // Azure DevOps does not support PATs+Bearer only JWTs+Bearer
                    email = 'VssEmail';
                    username = 'VssToken';
                    password64 = Buffer.from(apitoken).toString('base64');

                    auth = nerfed + ':username=' + username + lineEnd;
                    auth += nerfed + ':_password=' + password64 + lineEnd;
                    auth += nerfed + ':email=' + email + lineEnd;
                }
                break;
        }

        tl.setSecret(password);
        tl.setSecret(password64);

        auth += nerfed + ':always-auth=true';
        return new NpmRegistry(url, auth, authOnly);
    }
}

// Probe the endpoint to determine whether it is an Azure DevOps service
// by inspecting response headers for x-tfs / x-vss markers.
async function isEndpointInternal(endpointUrl: string): Promise<boolean> {
    const httpModule = endpointUrl.startsWith('https') ? await import('https') : await import('http');

    return new Promise<boolean>((resolve) => {
        const options: Record<string, any> = {
            headers: { 'X-TFS-FedAuthRedirect': 'Suppress' }
        };

        try {
            const proxy = tl.getHttpProxyConfiguration();
            if (proxy) {
                options.agent = new (require('https-proxy-agent'))(proxy.proxyUrl);
            }
        } catch {
            tl.debug('Unable to determine proxy configuration');
        }

        const req = httpModule.get(endpointUrl, options, (resp) => {
            resp.resume(); // drain body to prevent connection leak

            const rawHeaders = resp.rawHeaders || [];
            const isInternal = rawHeaders.some(
                h => h.toLowerCase().includes('x-tfs') || h.toLowerCase().includes('x-vss')
            );
            resolve(isInternal);
        });

        req.on('error', (error) => {
            tl.debug(`isEndpointInternal check failed: ${error}`);
            resolve(false);
        });
    });
}
