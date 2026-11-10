import * as tl from 'azure-pipelines-task-lib/task';

export type HostedUrlVerifier = (url: string) => Promise<URL>;

/**
 * Validates an Npm.PackagingCollectionUrl override before it can receive the system access token.
 * Hosted: verified against authenticated Packaging discovery (shared artifacts-common helper).
 * Non-hosted (on-premises): no discovery exists and HTTP is common, so the override must have the
 * same origin as the collection URI.
 * Returns the validated URL, or throws.
 */
export async function validatePackagingCollectionUrl(
    overrideUrl: string,
    serverType: string | undefined,
    collectionUris: string[],
    verifyHosted: HostedUrlVerifier
): Promise<string> {
    if (serverType && serverType.toLowerCase() === 'hosted') {
        return (await verifyHosted(overrideUrl)).href;
    }

    let parsed: URL;
    try {
        parsed = new URL(overrideUrl);
    } catch {
        throw new Error(tl.loc('PackagingCollectionUrlInvalid'));
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error(tl.loc('PackagingCollectionUrlUnsupportedScheme'));
    }

    if (parsed.username || parsed.password) {
        throw new Error(tl.loc('PackagingCollectionUrlHasCredentials'));
    }

    const trustedOrigins = (collectionUris || []).map(uri => {
        try {
            return new URL(uri).origin.toLowerCase();
        } catch {
            return undefined;
        }
    });

    if (!trustedOrigins.includes(parsed.origin.toLowerCase())) {
        throw new Error(tl.loc('PackagingCollectionUrlMismatch'));
    }

    return parsed.href;
}
