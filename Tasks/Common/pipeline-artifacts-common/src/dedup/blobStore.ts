import { HttpClient, HttpResponse } from '../http/httpClient';
import { ProtocolError } from '../errors';
import { Logger, nullLogger } from '../util/logger';
import { DedupHashType, parseHashType } from './chunker';
import { normalizeDedupId } from './hashing';

const DEDUP_RESOURCE_AREA = '01e4817c-857e-485c-9401-0334a33200da';
const API_VERSION = '7.1-preview.1';

export const DEFAULT_DOMAIN_ID = '0';

export interface BlobStoreLocation {
    baseUrl: string;
}

function trimSlash(value: string): string {
    return value.replace(/\/+$/, '');
}

export async function discoverBlobStore(http: HttpClient, collectionUri: string): Promise<BlobStoreLocation> {
    const root = trimSlash(collectionUri);
    const area = await http.json<{ locationUrl?: string }>(`${root}/_apis/ResourceAreas/${DEDUP_RESOURCE_AREA}`, {
        query: { 'api-version': API_VERSION },
        retries: 3
    });

    if (!area.locationUrl) {
        throw new ProtocolError('The organization does not advertise a dedup (blob store) service.');
    }
    return { baseUrl: trimSlash(area.locationUrl) };
}

export interface BlobStoreClientSettings {
    hashType?: DedupHashType;
    maxParallelism?: number;
    redirectTimeoutSeconds?: number;
    defaultDomainId?: string;
    properties: Record<string, string>;
}

function lookup(properties: Record<string, string>, ...names: string[]): string | undefined {
    const lower = new Map(Object.keys(properties).map(key => [key.toLowerCase(), key] as const));
    for (const name of names) {
        const key = lower.get(name.toLowerCase());
        if (key !== undefined && properties[key] !== undefined && properties[key] !== null && String(properties[key]).trim() !== '') {
            return String(properties[key]).trim();
        }
    }
    return undefined;
}

function positiveInteger(value: string | undefined): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function getClientSettings(
    http: HttpClient,
    readUrl: string,
    client: 'PipelineArtifact' | string = 'PipelineArtifact',
    logger: Logger = nullLogger
): Promise<BlobStoreClientSettings> {
    try {
        const settings = await http.json<{ properties?: Record<string, string> }>(
            `${trimSlash(readUrl)}/_apis/clienttools/${encodeURIComponent(client)}/settings`,
            { query: { 'api-version': API_VERSION }, retries: 3 }
        );
        const properties = settings.properties ?? {};
        logger.debug(`Blob store client settings: ${JSON.stringify(properties)}`);
        return {
            hashType: parseHashType(lookup(properties, 'ChunkSize', 'HashType')),
            maxParallelism: positiveInteger(lookup(properties, 'MaxParallelism')),
            redirectTimeoutSeconds: positiveInteger(lookup(properties, 'RedirectTimeout', 'RedirectTimeoutSeconds')),
            defaultDomainId: lookup(properties, 'DefaultDomainId', 'DomainId'),
            properties
        };
    } catch (error) {
        logger.warning(`Could not read the blob store client settings, using defaults: ${(error as Error).message}`);
        return { properties: {} };
    }
}

export interface Receipt {
    keepUntil: Date;
    keepUntilText: string;
    signature: Buffer;
}

export interface DedupTransportOptions {
    http: HttpClient;
    location: BlobStoreLocation;
    domainId?: string;
    logger?: Logger;
}

export class DedupTransport {
    readonly domainId: string;
    private readonly http: HttpClient;
    private readonly location: BlobStoreLocation;
    private readonly logger: Logger;

    constructor(options: DedupTransportOptions) {
        this.http = options.http;
        this.location = options.location;
        this.domainId = (options.domainId ?? DEFAULT_DOMAIN_ID).trim() || DEFAULT_DOMAIN_ID;
        this.logger = options.logger ?? nullLogger;
    }

    private get routePrefix(): string {
        return this.domainId === DEFAULT_DOMAIN_ID ? '_apis/dedup' : `_apis/domains/${encodeURIComponent(this.domainId)}/dedup`;
    }

    private readRoute(...segments: string[]): string {
        return [trimSlash(this.location.baseUrl), this.routePrefix, ...segments].join('/');
    }

    private writeRoute(...segments: string[]): string {
        return this.readRoute(...segments);
    }

    async resolveUrls(ids: readonly string[], signal?: AbortSignal): Promise<Record<string, string>> {
        const response = await this.http.request(this.readRoute('urls'), {
            method: 'POST',
            query: { allowEdge: 'true' },
            headers: {
                'Content-Type': 'application/json; charset=utf-8; api-version=1.0-preview',
                Accept: 'application/json; api-version=1.0'
            },
            body: JSON.stringify(ids),
            retries: 4,
            signal
        });
        let parsed: unknown;
        try {
            parsed = JSON.parse(response.body.toString('utf8'));
        } catch {
            throw new ProtocolError('The dedup service returned invalid JSON for blob URLs.');
        }
        if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
            throw new ProtocolError('The dedup service returned an unexpected blob URL response.');
        }
        const result: Record<string, string> = {};
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof value !== 'string') {
                throw new ProtocolError('The dedup service returned an invalid blob URL.');
            }
            result[normalizeDedupId(key, 'blob URL identifier')] = value;
        }
        return result;
    }

    putChunks(body: Buffer, chunkLengths: ReadonlyArray<{ id: string; length: number }>, keepUntil: Date, signal?: AbortSignal): Promise<HttpResponse> {
        const headers: Record<string, string> = {
            Accept: 'application/json; api-version=1.0',
            'Content-Type': 'application/octet-stream; api-version=1.0-preview',
            'Content-Range': `bytes */${body.length}`,
            'Accept-Encoding': 'identity'
        };
        for (const chunk of chunkLengths) {
            headers[`X-ms-chunk-${chunk.id}`] = `${chunk.length}/false`;
        }
        return this.http.request(this.writeRoute('chunks'), {
            method: 'PUT',
            query: { keepUntil: formatKeepUntil(keepUntil) },
            headers,
            body,
            retries: 4,
            maxResponseBytes: 2 * 1024 * 1024,
            signal
        });
    }

    putNode(id: string, body: Buffer, keepUntil: Date, retentionHeaders: Record<string, string>, signal?: AbortSignal): Promise<HttpResponse> {
        return this.http.request(this.writeRoute('nodes', id), {
            method: 'PUT',
            query: { keepUntil: formatKeepUntil(keepUntil) },
            headers: {
                Accept: 'application/json; api-version=1.0',
                'Content-Type': 'application/octet-stream; api-version=1.0-preview',
                'Content-Range': `bytes */${body.length}`,
                'Accept-Encoding': 'identity',
                ...retentionHeaders
            },
            body,
            acceptStatuses: [409],
            retries: 4,
            maxResponseBytes: 2 * 1024 * 1024,
            signal
        });
    }

    describe(): string {
        return `${this.location.baseUrl} (domain ${this.domainId})`;
    }
}

export function formatKeepUntil(date: Date): string {
    return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}
