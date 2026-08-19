// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

/**
 * Known Azure Artifacts / Azure DevOps domain patterns.
 * Requires 'pkgs' subdomain — e.g. pkgs.dev.azure.com or {org}.pkgs.visualstudio.com.
 */
const AZURE_ARTIFACTS_DOMAINS = '(?:[\\w.-]+\\.)*pkgs\\.(?:dev\\.azure\\.com|visualstudio\\.com|vsts\\.me|codedev\\.ms|devppe\\.azure\\.com|codeapp\\.ms)';

/**
 * Regex matching Azure Artifacts feed URLs across all known domains.
 * Uses the 'gi' flags — callers that reuse the same instance should
 * reset `lastIndex` or use `String.prototype.match` (which resets automatically).
 */
export const AZURE_ARTIFACTS_URL_PATTERN = new RegExp(
    `https?:\\/\\/${AZURE_ARTIFACTS_DOMAINS}\\/[^\\s'")<>]+`, 'gi');

/**
 * Returns true when the URL belongs to a known Azure Artifacts domain.
 */
export function isAzureArtifactsUrl(url: string): boolean {
    return url.match(AZURE_ARTIFACTS_URL_PATTERN) !== null;
}

/**
 * Normalizes a URL by trimming whitespace, lower-casing, and stripping trailing slashes.
 */
export function normalizeUrl(url: string): string {
    return url.trim().toLowerCase().replace(/\/+$/, '');
}
