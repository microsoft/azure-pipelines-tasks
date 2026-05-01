// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

export const DEFAULT_DUMMY_VERSION = '0.0.0';

/**
 * Regex matching Azure Artifacts feed URLs across all known domains.
 * Uses the 'gi' flags — callers that reuse the same instance should
 * reset `lastIndex` or use `String.prototype.match` (which resets automatically).
 */
export const AZURE_ARTIFACTS_URL_PATTERN = /https?:\/\/(?:[\w.-]+\.)?(?:dev\.azure\.com|visualstudio\.com|vsts\.me|codedev\.ms|devppe\.azure\.com|codeapp\.ms)\/[^\s'")<>]+/gi;

/**
 * Returns true when the URL belongs to a known Azure Artifacts domain.
 */
export function isAzureArtifactsUrl(url: string): boolean {
    return /(?:[\w.-]+\.)?(?:dev\.azure\.com|visualstudio\.com|vsts\.me|codedev\.ms|devppe\.azure\.com|codeapp\.ms)/i.test(url);
}

export function normalizeUrl(url: string): string {
    return url.toLowerCase().replace(/\/+$/, '');
}
