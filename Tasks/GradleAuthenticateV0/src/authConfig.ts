// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as tl from 'azure-pipelines-task-lib/task';
import { IssueSource } from 'azure-pipelines-task-lib/internal';
import { normalizeUrl } from './utils/urlUtils';
import { parseAzureArtifactsFeedUrl, verifyAzureArtifactsFeedUrl } from 'azure-pipelines-tasks-artifacts-common/feedUrlUtils';
import { getFederatedWorkloadIdentityCredentialsForFeed } from 'azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils';
import { ProtocolType } from 'azure-pipelines-tasks-artifacts-common/protocols';

const RESOURCE_TENANT_HEADER = 'x-vss-resourcetenant';

/**
 * Auth config entry for one feed, written to azure-artifacts-auth-config.json.
 */
export interface FeedAuthEntry {
    url: string;
    auth: 'sat' | 'wif';
    ciSystem: 'ado';
    accessToken?: string;
    oidcEndpoint?: string;
    clientId?: string;
    tenantId?: string;
}

/**
 * Top-level auth config structure.
 */
export interface AuthConfigFile {
    feeds: FeedAuthEntry[];
}

/**
 * Write (or merge into) the auth config JSON file.
 * Multiple GradleAuthenticate invocations are additive — entries are merged
 * by URL, with later entries overwriting earlier ones for the same URL.
 */
export function writeAuthConfig(configPath: string, newEntries: FeedAuthEntry[]): void {
    let existing: AuthConfigFile = { feeds: [] };

    // Read existing config if present (additive invocations)
    if (fs.existsSync(configPath)) {
        try {
            const content = fs.readFileSync(configPath, 'utf-8');
            existing = JSON.parse(content) as AuthConfigFile;
        } catch {
            tl.warning(tl.loc('Warning_CorruptAuthConfig'), IssueSource.TaskInternal);
        }
    }

    // Merge: deduplicate by normalized URL, new entries win
    const byUrl = new Map<string, FeedAuthEntry>();
    for (const entry of existing.feeds) {
        byUrl.set(normalizeUrl(entry.url), entry);
    }
    for (const entry of newEntries) {
        byUrl.set(normalizeUrl(entry.url), entry);
    }

    const merged: AuthConfigFile = { feeds: Array.from(byUrl.values()) };
    fs.writeFileSync(configPath, JSON.stringify(merged, null, 2), 'utf-8');
}

/**
 * Probe a feed URL with a GET request and extract the X-VSS-ResourceTenant
 * header, which contains the tenant ID that owns the feed. This may differ
 * from the service connection's tenant in cross-org scenarios.
 */
export async function probeFeedTenantId(feedUrl: string): Promise<string | null> {
    const mod = feedUrl.startsWith('https') ? https : http;
    try {
        const tenantHeader = await new Promise<string | string[] | undefined>((resolve, reject) => {
            const req = mod.get(feedUrl, { timeout: 10_000 }, (res) => {
                resolve(res.headers[RESOURCE_TENANT_HEADER]);
                res.resume();
            });
            req.on('error', reject);
            req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
        });
        if (tenantHeader) {
            const value = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;
            return value || null;
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * Build auth config entries for all discovered feeds. Probes tenant IDs
 * in parallel and produces SAT or WIF entries depending on whether a
 * service connection is configured.
 */
export async function buildAuthEntries(
    feeds: { url: string }[],
    adoServiceConnection: string
): Promise<FeedAuthEntry[]> {
    if (adoServiceConnection) {
        return await Promise.all(feeds.map(async feed => {
            const credentials = await getFederatedWorkloadIdentityCredentialsForFeed(
                adoServiceConnection,
                parseAzureArtifactsFeedUrl(feed.url),
                ProtocolType.Maven);
            if (!credentials) {
                throw new Error(tl.loc('FailedToGetServiceConnectionAuth', adoServiceConnection));
            }

            return {
                url: credentials.feedUrl.href,
                auth: 'sat' as const,
                ciSystem: 'ado' as const,
                accessToken: credentials.accessToken
            };
        }));
    }

    const verifiedFeeds = await Promise.all(feeds.map(async feed => ({
        url: (await verifyAzureArtifactsFeedUrl(
            parseAzureArtifactsFeedUrl(feed.url),
            ProtocolType.Maven
        )).href
    })));
    return verifiedFeeds.map(feed => ({
        url: feed.url,
        auth: 'sat' as const,
        ciSystem: 'ado' as const
    }));
}
