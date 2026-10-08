// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import { URL } from 'url';

/**
 * Known Azure Artifacts / Azure DevOps domain patterns.
 * Requires 'pkgs' subdomain — e.g. pkgs.dev.azure.com or {org}.pkgs.visualstudio.com.
 */
const AZURE_ARTIFACTS_DOMAINS = '(?:[\\w.-]+\\.)*pkgs\\.(?:dev\\.azure\\.com|visualstudio\\.com|vsts\\.me|codedev\\.ms|devppe\\.azure\\.com|codeapp\\.ms)';
const AZURE_ARTIFACTS_HOST_PATTERN = new RegExp(`^${AZURE_ARTIFACTS_DOMAINS}$`, 'i');

/**
 * Regex matching Azure Artifacts feed URLs across all known domains.
 * Uses the 'gi' flags — callers that reuse the same instance should
 * reset `lastIndex` or use `String.prototype.match` (which resets automatically).
 */
export const AZURE_ARTIFACTS_URL_PATTERN = new RegExp(
    `https?:\\/\\/${AZURE_ARTIFACTS_DOMAINS}\\/[^\\s'")<>]+`, 'gi');

/**
 * Returns true when the value is an absolute HTTPS URL on a known Azure Artifacts domain.
 */
export function isValidAzureArtifactsUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:'
            && AZURE_ARTIFACTS_HOST_PATTERN.test(parsed.hostname);
    } catch {
        return false;
    }
}

/**
 * Normalizes a URL by trimming whitespace, lower-casing, and stripping trailing slashes.
 */
export function normalizeUrl(url: string): string {
    return url.trim().toLowerCase().replace(/\/+$/, '');
}
