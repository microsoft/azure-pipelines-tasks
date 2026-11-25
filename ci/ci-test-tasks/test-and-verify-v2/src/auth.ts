import { execFileSync } from 'node:child_process';
import { BearerCredentialHandler } from 'azure-devops-node-api/handlers/bearertoken';

function getExpiration(token: string): number {
    let payload: { exp?: unknown };
    try {
        payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    } catch {
        throw new Error('Invalid service connection token');
    }
    if (!payload || typeof payload.exp !== 'number' || !Number.isFinite(payload.exp)) {
        throw new Error('Invalid service connection token expiration');
    }
    return payload.exp * 1000;
}

export function getServiceConnectionHandler(token: string) {
    if (!token) {
        throw new Error('Service connection token is not provided');
    }
    let expiresAt = getExpiration(token);
    const handler = new BearerCredentialHandler(token, false);
    const prepareRequest = handler.prepareRequest.bind(handler);
    handler.prepareRequest = options => {
        // Canary jobs can outlive an Entra token; AzureCLI keeps the connection authenticated.
        if (expiresAt <= Date.now() + 5 * 60 * 1000) {
            const refreshedToken = execFileSync('az', [
                'account', 'get-access-token',
                '--resource', '499b84ac-1321-427f-aa17-267ca6975798',
                '--query', 'accessToken', '--output', 'tsv', '--only-show-errors'
            ], { encoding: 'utf8', timeout: 60000 }).trim();
            console.log(`##vso[task.setsecret]${refreshedToken}`);
            expiresAt = getExpiration(refreshedToken);
            if (expiresAt <= Date.now() + 5 * 60 * 1000) {
                throw new Error('Azure CLI returned an expiring service connection token');
            }
            handler.token = refreshedToken;
        }
        prepareRequest(options);
    };
    return handler;
}
