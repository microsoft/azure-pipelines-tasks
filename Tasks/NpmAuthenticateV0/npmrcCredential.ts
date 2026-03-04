/**
 * npmrcCredential.ts
 *
 * Resolves service endpoint credentials into .npmrc auth lines.
 *
 * Given a service endpoint ID, this module reads the endpoint's URL and auth
 * scheme from the task lib, determines whether the endpoint targets an Azure
 * DevOps registry (via an HTTP probe), and formats the appropriate .npmrc
 * credential lines.  All secret values are masked via tl.setSecret().
 */

import * as os from 'os';
import * as tl from 'azure-pipelines-task-lib/task';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A resolved credential entry ready to be written into an .npmrc file. */
export interface NpmrcCredential {
    /** The registry URL this credential applies to. */
    url: string;
    /** One or more .npmrc auth lines (e.g. nerfDart:_authToken=...). */
    auth: string;
    /** When true, only auth lines are written — no registry= line. */
    authOnly: boolean;
}

/** Intermediate representation of endpoint username/password/email fields. */
interface EndpointCredentials {
    username: string;
    password: string;
    email: string;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Build an NpmrcCredential from a service endpoint ID.
 *
 * Reads the endpoint's URL and auth scheme from the task lib, determines
 * whether the endpoint targets an Azure DevOps registry (via an HTTP probe),
 * and formats the appropriate .npmrc auth lines:
 *   - Token + internal:  basic auth (VssToken / base64 password)
 *   - Token + external:  bearer auth (_authToken)
 *   - UsernamePassword:  basic auth (username / base64 password)
 */
export async function resolveServiceEndpointCredential(
    endpointId: string,
    normalizeRegistry: (url: string) => string,
    toNerfDart: (url: string) => string
): Promise<NpmrcCredential> {
    const endpointAuth = getEndpointAuth(endpointId);
    const endpointUrl = getEndpointUrl(endpointId, normalizeRegistry);
    const nerfed = toNerfDart(endpointUrl);

    // For Token auth, probe the endpoint to determine if it's an Azure DevOps
    // registry (uses basic auth) or an external registry (uses bearer token).
    const isInternalEndpoint = endpointAuth.scheme === 'Token'
        ? await isEndpointInternal(endpointUrl)
        : false;

    const credentials = buildEndpointCredentials(endpointAuth, isInternalEndpoint);
    const auth = formatNpmrcAuthLines(nerfed, credentials);

    // Mask raw secrets so they don't appear in pipeline logs.
    if (credentials.password) {
        tl.setSecret(credentials.password);
    }

    return { url: endpointUrl, auth, authOnly: true };
}

// ─── Endpoint auth resolution ────────────────────────────────────────────────

/** Read endpoint authorization, throwing a clear error on failure. */
function getEndpointAuth(endpointId: string): tl.EndpointAuthorization {
    try {
        return tl.getEndpointAuthorization(endpointId, false);
    } catch {
        throw new Error(tl.loc('ServiceEndpointNotDefined'));
    }
}

/** Read and normalize the endpoint URL. */
function getEndpointUrl(endpointId: string, normalizeRegistry: (url: string) => string): string {
    try {
        return normalizeRegistry(tl.getEndpointUrl(endpointId, false));
    } catch {
        throw new Error(tl.loc('ServiceEndpointUrlNotDefined'));
    }
}

/**
 * Map an endpoint auth scheme to username/password/email fields.
 * Token auth on Azure DevOps endpoints is re-encoded as basic auth
 * because Azure DevOps npm registries don't support Bearer PATs.
 */
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
                // External registry — use bearer auth directly.
                return { username: '', password: apitoken, email: '' };
            }
            // Azure DevOps — re-encode as basic auth.
            return { username: 'VssToken', password: apitoken, email: 'VssEmail' };
        }
        default:
            throw new Error(`Unsupported auth scheme: ${endpointAuth.scheme}`);
    }
}

// ─── Auth line formatting ────────────────────────────────────────────────────

/** Format credential fields into .npmrc auth lines. */
function formatNpmrcAuthLines(nerfed: string, credentials: EndpointCredentials): string {
    const lineEnd = os.EOL;

    // Bearer-style (external token — no username, just a token)
    if (!credentials.username && credentials.password) {
        return `${nerfed}:_authToken=${credentials.password}${lineEnd}`
             + `${nerfed}:always-auth=true`;
    }

    // Basic-style (username + base64-encoded password)
    const password64 = Buffer.from(credentials.password).toString('base64');
    tl.setSecret(password64);

    return `${nerfed}:username=${credentials.username}${lineEnd}`
         + `${nerfed}:_password=${password64}${lineEnd}`
         + `${nerfed}:email=${credentials.email}${lineEnd}`
         + `${nerfed}:always-auth=true`;
}

// ─── Internal endpoint detection ─────────────────────────────────────────────

/**
 * Probe the endpoint to determine whether it is an Azure DevOps service
 * by inspecting HTTP response headers for x-tfs / x-vss markers.
 */
async function isEndpointInternal(endpointUrl: string): Promise<boolean> {
    const httpModule = endpointUrl.startsWith('https') ? await import('https') : await import('http');

    return new Promise<boolean>((resolve) => {
        const options: Record<string, any> = {
            headers: { 'X-TFS-FedAuthRedirect': 'Suppress' }
        };

        // Use proxy if configured.
        try {
            const proxy = tl.getHttpProxyConfiguration();
            if (proxy) {
                options.agent = new (require('https-proxy-agent'))(proxy.proxyUrl);
            }
        } catch {
            tl.debug('Unable to determine proxy configuration');
        }

        const req = httpModule.get(endpointUrl, options, (resp) => {
            // Drain the response body to prevent connection leak.
            resp.resume();

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
