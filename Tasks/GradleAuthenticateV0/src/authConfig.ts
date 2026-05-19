// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.

import * as fs from 'fs';
import * as http from 'http';
import * as https from 'https';
import * as tl from 'azure-pipelines-task-lib/task';
import { normalizeUrl } from './urlUtils';

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
            tl.warning(tl.loc('Warning_CorruptAuthConfig', configPath));
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
export function probeFeedTenantId(feedUrl: string): Promise<string | null> {
    return new Promise((resolve) => {
        const mod = feedUrl.startsWith('https') ? https : http;
        const req = mod.get(feedUrl, { timeout: 10_000 }, (res) => {
            const tenantHeader = res.headers['x-vss-resourcetenant'];
            if (tenantHeader) {
                const value = Array.isArray(tenantHeader) ? tenantHeader[0] : tenantHeader;
                resolve(value || null);
            } else {
                resolve(null);
            }
            res.resume();
        });
        req.on('error', () => resolve(null));
        req.on('timeout', () => { req.destroy(); resolve(null); });
    });
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
    if (!adoServiceConnection) {
        return feeds.map(feed => ({ url: feed.url, auth: 'sat' as const, ciSystem: 'ado' as const }));
    }

    const tenantIds = await Promise.all(feeds.map(feed => probeFeedTenantId(feed.url)));

    const entries: FeedAuthEntry[] = [];
    for (let i = 0; i < feeds.length; i++) {
        const feed = feeds[i];
        const feedTenantId = tenantIds[i];

        if (feedTenantId) {
            console.log(tl.loc('Info_FeedResourceTenant', feed.url, feedTenantId));
        } else {
            tl.warning(tl.loc('Warning_CouldNotDetermineResourceTenant', feed.url));
        }

        entries.push(buildWifEntry(feed.url, adoServiceConnection, feedTenantId));
    }

    return entries;
}

function buildWifEntry(feedUrl: string, serviceConnection: string, feedTenantId: string | null): FeedAuthEntry {
    const oidcRequestUri = tl.getVariable('System.OidcRequestUri');
    if (!oidcRequestUri) {
        tl.warning(tl.loc('Warning_MissingSystemVariable', 'System.OidcRequestUri'));
    }

    const oidcEndpoint = oidcRequestUri
        ? `${oidcRequestUri}?api-version=7.1&serviceConnectionId=${serviceConnection}`
        : '';

    let clientId = '';
    let tenantId = feedTenantId || '';
    try {
        clientId = tl.getEndpointAuthorizationParameter(serviceConnection, 'serviceprincipalid', false) || '';
    } catch {
        tl.warning(tl.loc('Warning_MissingSystemVariable', 'serviceprincipalid'));
    }
    if (!tenantId) {
        try {
            tenantId = tl.getEndpointAuthorizationParameter(serviceConnection, 'tenantid', false) || '';
        } catch {
            tl.warning(tl.loc('Warning_MissingSystemVariable', 'tenantid'));
        }
    }

    return { url: feedUrl, auth: 'wif' as const, ciSystem: 'ado' as const, oidcEndpoint, clientId, tenantId };
}
