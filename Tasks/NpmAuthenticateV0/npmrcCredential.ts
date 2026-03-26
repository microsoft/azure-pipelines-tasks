import * as os from 'os';
import * as tl from 'azure-pipelines-task-lib/task';

export interface NpmrcCredential {
    url: string;
    auth: string;
}

interface EndpointCredentials {
    username: string;
    password: string;
    email: string;
}

export async function resolveServiceEndpointCredential(
    endpointId: string,
    normalizeRegistry: (url: string) => string,
    toNerfDart: (url: string) => string
): Promise<NpmrcCredential> {
    const endpointAuth = getEndpointAuth(endpointId);
    const endpointUrl = getEndpointUrl(endpointId, normalizeRegistry);
    const nerfed = toNerfDart(endpointUrl);

    // For Token auth, probe whether this is an Azure DevOps registry (basic auth)
    // or an external registry (bearer token).
    const isInternalEndpoint = endpointAuth.scheme === 'Token'
        ? await isEndpointInternal(endpointUrl)
        : false;

    const credentials = buildEndpointCredentials(endpointAuth, isInternalEndpoint);
    const auth = formatNpmrcAuthLines(nerfed, credentials);

    if (credentials.password) {
        tl.setSecret(credentials.password);
    }

    return { url: endpointUrl, auth };
}

function getEndpointAuth(endpointId: string): tl.EndpointAuthorization {
    try {
        return tl.getEndpointAuthorization(endpointId, false);
    } catch {
        throw new Error(tl.loc('ServiceEndpointNotDefined'));
    }
}

function getEndpointUrl(endpointId: string, normalizeRegistry: (url: string) => string): string {
    try {
        return normalizeRegistry(tl.getEndpointUrl(endpointId, false));
    } catch {
        throw new Error(tl.loc('ServiceEndpointUrlNotDefined'));
    }
}

// ADO npm registries don't support Bearer PATs, so Token auth gets re-encoded as basic auth
function buildEndpointCredentials(
    endpointAuth: tl.EndpointAuthorization,
    isInternalEndpoint: boolean
): EndpointCredentials {
    switch (endpointAuth.scheme) {
        case 'UsernamePassword': {
            const username = endpointAuth.parameters['username'];
            const password = endpointAuth.parameters['password'];
            return { username, password, email: username };
        }
        case 'Token': {
            const apitoken = endpointAuth.parameters['apitoken'];
            tl.setSecret(apitoken);
            if (!isInternalEndpoint) {
                return { username: '', password: apitoken, email: '' };
            }
            return { username: 'VssToken', password: apitoken, email: 'VssEmail' };
        }
        default:
            throw new Error(tl.loc('Error_UnsupportedAuthScheme', endpointAuth.scheme));
    }
}

function formatNpmrcAuthLines(nerfed: string, credentials: EndpointCredentials): string {
    const lineEnd = os.EOL;

    // Bearer-style (external token)
    if (!credentials.username && credentials.password) {
        return `${nerfed}:_authToken=${credentials.password}${lineEnd}`
             + `${nerfed}:always-auth=true`;
    }

    // Basic-style (username + base64 password)
    const password64 = Buffer.from(credentials.password).toString('base64');
    tl.setSecret(password64);

    return `${nerfed}:username=${credentials.username}${lineEnd}`
         + `${nerfed}:_password=${password64}${lineEnd}`
         + `${nerfed}:email=${credentials.email}${lineEnd}`
         + `${nerfed}:always-auth=true`;
}

// Probes the endpoint with an HTTP GET to check for x-tfs/x-vss response
// headers, which indicate an Azure DevOps service.
async function isEndpointInternal(endpointUrl: string): Promise<boolean> {
    const httpModule = endpointUrl.startsWith('https') ? await import('https') : await import('http');
    const TIMEOUT_MS = 10000;

    return new Promise<boolean>((resolve) => {
        const options: Record<string, any> = {
            headers: { 'X-TFS-FedAuthRedirect': 'Suppress' },
            timeout: TIMEOUT_MS
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
            resp.resume();

            const rawHeaders = resp.rawHeaders || [];
            const isInternal = rawHeaders.some(
                h => h.toLowerCase().includes('x-tfs') || h.toLowerCase().includes('x-vss')
            );
            resolve(isInternal);
        });

        req.on('timeout', () => {
            tl.debug(`isEndpointInternal timed out after ${TIMEOUT_MS}ms`);
            req.destroy();
            resolve(false);
        });

        req.on('error', (error) => {
            tl.debug(`isEndpointInternal check failed: ${error}`);
            resolve(false);
        });
    });
}
