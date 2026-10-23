import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { Duplex } from 'stream';
import * as tls from 'tls';
import * as zlib from 'zlib';
import { URL } from 'url';
import { AbortedError, HttpError } from '../errors';
import { Logger, nullLogger } from '../util/logger';
import { withRetry } from '../util/concurrency';

export interface ProxyConfig {
    url: string;
    username?: string;
    password?: string;
    bypass?: string[];
}

export interface HttpClientOptions {
    authorization?: () => string | undefined | Promise<string | undefined>;
    /**
     * Host names that may receive the Authorization header. A leading dot matches the host and all of its sub
     * domains. When omitted, the header is sent to every host the caller marks as authenticated.
     */
    trustedHosts?: string[];
    userAgent?: string;
    proxy?: ProxyConfig;
    ca?: Array<string | Buffer>;
    rejectUnauthorized?: boolean;
    allowInsecureLoopback?: boolean;
    maxSockets?: number;
    timeoutMs?: number;
    logger?: Logger;
}

export interface RequestOptions {
    method?: string;
    headers?: Record<string, string>;
    body?: Buffer | string;
    authenticated?: boolean;
    query?: Record<string, string | number | boolean | undefined>;
    timeoutMs?: number;
    deadlineMs?: number;
    retries?: number;
    acceptStatuses?: number[];
    maxResponseBytes?: number;
    maxRedirects?: number;
    signal?: AbortSignal;
}

export interface HttpResponse {
    status: number;
    headers: http.IncomingHttpHeaders;
    body: Buffer;
    url: string;
}

export interface HttpStream {
    status: number;
    headers: http.IncomingHttpHeaders;
    stream: http.IncomingMessage;
    url: string;
}

const TRANSIENT_STATUSES = new Set([408, 429, 500, 502, 503, 504]);
const TRANSIENT_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'EAI_AGAIN', 'EHOSTUNREACH', 'ENETUNREACH', 'ECONNABORTED', 'ERR_STREAM_PREMATURE_CLOSE', 'UND_ERR_SOCKET']);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;
export const DEFAULT_DEADLINE_MS = 30 * 60 * 1000;

export class RequestTimeoutError extends Error {
    readonly code = 'ETIMEDOUT';
    constructor(message: string) {
        super(message);
        this.name = 'RequestTimeoutError';
    }
}

export function isTransientError(error: unknown): boolean {
    if (error instanceof AbortedError) {
        return false;
    }
    if (error instanceof HttpError) {
        return TRANSIENT_STATUSES.has(error.status);
    }
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code !== undefined && TRANSIENT_CODES.has(code);
}

/** The stream that undoes the Content-Encoding of a response, or undefined when the body is not encoded. */
export function contentDecoder(contentEncoding: string | string[] | undefined): zlib.Gunzip | zlib.Inflate | zlib.BrotliDecompress | undefined {
    const encoding = String(Array.isArray(contentEncoding) ? contentEncoding[0] : contentEncoding ?? '').trim().toLowerCase();
    if (encoding === 'gzip' || encoding === 'x-gzip') {
        return zlib.createGunzip();
    }
    if (encoding === 'deflate') {
        return zlib.createInflate();
    }
    if (encoding === 'br') {
        return zlib.createBrotliDecompress();
    }
    return undefined;
}

function hostMatches(host: string, patterns: string[]): boolean {
    const lower = host.toLowerCase();
    return patterns.some(pattern => {
        const entry = pattern.toLowerCase();
        return entry.startsWith('.') ? lower === entry.substring(1) || lower.endsWith(entry) : lower === entry;
    });
}

class TunnelAgent extends https.Agent {
    constructor(private readonly proxy: URL, private readonly proxyAuthorization: string | undefined, options: https.AgentOptions) {
        super(options);
    }

    createConnection(options: https.RequestOptions, callback?: (error: Error | null, stream: Duplex) => void): Duplex | null | undefined {
        const host = String(options.host ?? options.hostname);
        const port = Number(options.port ?? 443);
        const connect = http.request({
            host: this.proxy.hostname,
            port: Number(this.proxy.port || 80),
            method: 'CONNECT',
            path: `${host}:${port}`,
            headers: {
                Host: `${host}:${port}`,
                ...(this.proxyAuthorization ? { 'Proxy-Authorization': this.proxyAuthorization } : {})
            }
        });
        connect.once('connect', (response, socket) => {
            if (response.statusCode !== 200) {
                socket.destroy();
                callback?.(new Error(`The proxy refused the CONNECT request to ${host}:${port} (HTTP ${response.statusCode}).`), undefined as unknown as Duplex);
                return;
            }
            const secure = tls.connect({
                socket,
                servername: (options as tls.ConnectionOptions).servername ?? (net.isIP(host) ? undefined : host),
                ca: options.ca,
                rejectUnauthorized: options.rejectUnauthorized
            });
            secure.once('secureConnect', () => callback?.(null, secure));
            secure.once('error', error => callback?.(error, undefined as unknown as Duplex));
        });
        connect.once('error', error => callback?.(error, undefined as unknown as Duplex));
        connect.end();
        return undefined;
    }
}

export class HttpClient {
    private readonly logger: Logger;
    private readonly direct: https.Agent;
    private readonly plain = new http.Agent({ keepAlive: true, maxSockets: 128 });
    private tunnel: https.Agent | undefined;
    private readonly proxyUrl: URL | undefined;
    private readonly bypassPatterns: RegExp[] = [];
    private readonly ca: Array<string | Buffer> | undefined;

    constructor(private readonly options: HttpClientOptions = {}) {
        this.logger = options.logger ?? nullLogger;
        this.ca = options.ca && options.ca.length ? [...tls.rootCertificates, ...options.ca] : undefined;
        this.direct = new https.Agent({
            keepAlive: true,
            maxSockets: options.maxSockets ?? 256,
            maxFreeSockets: options.maxSockets ?? 256,
            ca: this.ca,
            rejectUnauthorized: options.rejectUnauthorized
        });

        const proxy = options.proxy?.url
            ?? process.env.HTTPS_PROXY ?? process.env.https_proxy ?? process.env.HTTP_PROXY ?? process.env.http_proxy;
        if (proxy) {
            this.proxyUrl = new URL(proxy);
            const bypass = options.proxy?.bypass ?? (process.env.NO_PROXY ?? process.env.no_proxy ?? '').split(',').map(entry => entry.trim()).filter(Boolean);
            for (const entry of bypass) {
                try {
                    this.bypassPatterns.push(new RegExp(entry, 'i'));
                } catch {
                    this.bypassPatterns.push(new RegExp(`(^|\\.)${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
                }
            }
        }
    }

    close(): void {
        this.direct.destroy();
        this.plain.destroy();
        this.tunnel?.destroy();
    }

    private agentFor(url: URL): https.Agent {
        if (!this.proxyUrl || this.bypassPatterns.some(pattern => pattern.test(url.hostname) || pattern.test(url.host))) {
            return this.direct;
        }
        let tunnel = this.tunnel;
        if (!tunnel) {
            const username = this.options.proxy?.username ?? decodeURIComponent(this.proxyUrl.username);
            const password = this.options.proxy?.password ?? decodeURIComponent(this.proxyUrl.password);
            const authorization = username ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` : undefined;
            tunnel = this.tunnel = new TunnelAgent(this.proxyUrl, authorization, {
                keepAlive: true,
                maxSockets: this.options.maxSockets ?? 256,
                maxFreeSockets: this.options.maxSockets ?? 256,
                ca: this.ca,
                rejectUnauthorized: this.options.rejectUnauthorized
            });
        }
        return tunnel;
    }

    private isAllowed(url: URL): boolean {
        if (url.protocol === 'https:') {
            return true;
        }
        return url.protocol === 'http:' && this.options.allowInsecureLoopback === true
            && (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]');
    }

    private buildUrl(input: string, query?: RequestOptions['query']): URL {
        const url = new URL(input);
        if (!this.isAllowed(url)) {
            throw new Error(`Only HTTPS service URLs are supported: ${url.protocol}//${url.host}`);
        }
        if (query) {
            for (const [key, value] of Object.entries(query)) {
                if (value !== undefined) {
                    url.searchParams.set(key, String(value));
                }
            }
        }
        return url;
    }

    private async buildHeaders(url: URL, options: RequestOptions, authenticated: boolean): Promise<Record<string, string>> {
        const headers: Record<string, string> = {
            'User-Agent': this.options.userAgent ?? 'azure-pipelines-tasks-pipeline-artifacts-common',
            ...options.headers
        };
        const hasHeader = (name: string) => Object.keys(headers).some(key => key.toLowerCase() === name);
        if (!hasHeader('accept-encoding')) {
            headers['Accept-Encoding'] = 'gzip, deflate';
        }
        if (authenticated && this.options.authorization && !hasHeader('authorization')
            && (!this.options.trustedHosts || hostMatches(url.hostname, this.options.trustedHosts))) {
            const authorization = await this.options.authorization();
            if (authorization) {
                headers['Authorization'] = authorization;
            }
        }
        return headers;
    }

    private open(url: URL, method: string, headers: Record<string, string>, body: Buffer | undefined, timeoutMs: number, signal?: AbortSignal, deadlineAt?: number): Promise<http.IncomingMessage> {
        return new Promise<http.IncomingMessage>((resolve, reject) => {
            if (signal?.aborted) {
                reject(new AbortedError());
                return;
            }

            const requestHeaders = { ...headers };
            if (body) {
                requestHeaders['Content-Length'] = String(body.length);
            } else if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
                requestHeaders['Content-Length'] = '0';
            }

            const secure = url.protocol === 'https:';
            const request = (secure ? https : http).request({
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || (secure ? 443 : 80),
                path: url.pathname + url.search,
                method,
                headers: requestHeaders,
                agent: secure ? this.agentFor(url) : this.plain,
                timeout: timeoutMs,
                servername: secure && !net.isIP(url.hostname) ? url.hostname : undefined
            } as https.RequestOptions);

            let received: http.IncomingMessage | undefined;
            const deadline = deadlineAt === undefined ? undefined : setTimeout(
                () => (received ?? request).destroy(new RequestTimeoutError(`The request to ${url.host} did not finish within its time limit.`)),
                Math.max(0, deadlineAt - Date.now()));
            deadline?.unref();

            const onAbort = () => request.destroy(new AbortedError());
            signal?.addEventListener('abort', onAbort, { once: true });
            const cleanup = () => {
                signal?.removeEventListener('abort', onAbort);
                clearTimeout(deadline);
            };

            request.once('timeout', () => request.destroy(new RequestTimeoutError(`The request to ${url.host} timed out after ${Math.round(timeoutMs / 1000)}s of inactivity.`)));
            request.once('error', error => {
                cleanup();
                reject(error);
            });
            request.once('response', response => {
                received = response;
                response.once('end', cleanup);
                response.once('error', cleanup);
                response.once('close', cleanup);
                resolve(response);
            });
            request.end(body);
        });
    }

    private async readBody(response: http.IncomingMessage, maxBytes: number): Promise<Buffer> {
        const decoder = contentDecoder(response.headers['content-encoding']);
        const source: NodeJS.ReadableStream = decoder ? response.pipe(decoder) : response;

        const chunks: Buffer[] = [];
        let total = 0;
        await new Promise<void>((resolve, reject) => {
            source.on('data', (chunk: Buffer) => {
                total += chunk.length;
                if (total > maxBytes) {
                    reject(new Error(`The response exceeds the supported size of ${maxBytes} bytes.`));
                    response.destroy();
                    return;
                }
                chunks.push(chunk);
            });
            source.once('end', resolve);
            source.once('error', reject);
            response.once('error', reject);
            response.once('aborted', () => reject(response.errored ?? Object.assign(new Error('The response was aborted.'), { code: 'ECONNRESET' })));
        });
        return Buffer.concat(chunks);
    }

    private async errorFor(url: URL, method: string, response: http.IncomingMessage): Promise<HttpError> {
        let text = '';
        try {
            text = (await this.readBody(response, 64 * 1024)).toString('utf8').substring(0, 2048);
        } catch {
            // The status code is what matters.
        }
        const requestId = (response.headers['x-vss-e2eid'] ?? response.headers['x-ms-request-id'] ?? response.headers['activityid']) as string | undefined;
        let detail = text;
        try {
            const parsed = JSON.parse(text);
            if (parsed && typeof parsed.message === 'string') {
                detail = parsed.message;
            }
        } catch {
            // Not JSON.
        }
        const status = response.statusCode ?? 0;
        return new HttpError(
            `${method} ${url.origin}${url.pathname} failed with HTTP ${status}${detail ? `: ${detail}` : ''}${requestId ? ` (request ${requestId})` : ''}`,
            status,
            requestId,
            text,
            parseRetryAfter(response.headers['retry-after'])
        );
    }

    async requestStream(input: string, options: RequestOptions = {}): Promise<HttpStream> {
        const method = (options.method ?? 'GET').toUpperCase();
        const authenticated = options.authenticated !== false;
        const accepted = new Set(options.acceptStatuses ?? []);
        const body = typeof options.body === 'string' ? Buffer.from(options.body, 'utf8') : options.body;
        let url = this.buildUrl(input, options.query);
        let headers = await this.buildHeaders(url, options, authenticated);
        let currentMethod = method;
        let currentBody = body;
        const deadlineAt = options.deadlineMs && options.deadlineMs > 0 ? Date.now() + options.deadlineMs : undefined;

        for (let redirects = 0; ; redirects++) {
            const started = Date.now();
            const response = await this.open(url, currentMethod, headers, currentBody, options.timeoutMs ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS, options.signal, deadlineAt);
            const status = response.statusCode ?? 0;
            this.logger.debug(`${currentMethod} ${url.origin}${url.pathname} -> ${status} (${Date.now() - started}ms)`);

            if (REDIRECT_STATUSES.has(status) && response.headers.location) {
                response.resume();
                if (redirects >= (options.maxRedirects ?? 5)) {
                    throw new HttpError(`Too many redirects while requesting ${url.origin}${url.pathname}.`, status);
                }
                const next = new URL(response.headers.location, url);
                if (!this.isAllowed(next)) {
                    throw new HttpError(`Refusing to follow a redirect to a non HTTPS location (${next.protocol}).`, status);
                }
                const nextHeaders = { ...headers };
                if (next.host !== url.host) {
                    delete nextHeaders['Authorization'];
                    delete nextHeaders['authorization'];
                }
                if (status === 303 || ((status === 301 || status === 302) && currentMethod === 'POST')) {
                    currentMethod = 'GET';
                    currentBody = undefined;
                    delete nextHeaders['Content-Type'];
                    delete nextHeaders['content-type'];
                }
                url = next;
                headers = nextHeaders;
                continue;
            }

            if ((status >= 200 && status < 300) || accepted.has(status)) {
                return { status, headers: response.headers, stream: response, url: url.toString() };
            }
            throw await this.errorFor(url, currentMethod, response);
        }
    }

    async request(input: string, options: RequestOptions = {}): Promise<HttpResponse> {
        const deadlineMs = options.deadlineMs ?? Math.max(DEFAULT_DEADLINE_MS, options.timeoutMs ?? this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
        const attemptOnce = async (): Promise<HttpResponse> => {
            const result = await this.requestStream(input, { ...options, deadlineMs });
            const body = await this.readBody(result.stream, options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES);
            return { status: result.status, headers: result.headers, body, url: result.url };
        };

        if (!options.retries) {
            return attemptOnce();
        }

        return withRetry(() => attemptOnce(), {
            retries: options.retries,
            signal: options.signal,
            shouldRetry: error => isTransientError(error),
            delayHint: error => error instanceof HttpError ? error.retryAfterMs : undefined,
            onRetry: (error, attempt, wait) => this.logger.debug(`Retrying ${options.method ?? 'GET'} ${input.split('?')[0]} (attempt ${attempt + 1}) in ${wait}ms: ${(error as Error).message}`)
        });
    }

    async json<T = unknown>(input: string, options: RequestOptions = {}): Promise<T> {
        const response = await this.request(input, {
            ...options,
            headers: { Accept: 'application/json', ...options.headers }
        });
        try {
            return JSON.parse(response.body.toString('utf8')) as T;
        } catch {
            throw new HttpError(`The response of ${input.split('?')[0]} is not valid JSON.`, response.status);
        }
    }
}

function parseRetryAfter(value: string | string[] | undefined): number | undefined {
    const text = Array.isArray(value) ? value[0] : value;
    if (!text) {
        return undefined;
    }
    if (/^\d+$/.test(text)) {
        return Number(text) * 1000;
    }
    const date = Date.parse(text);
    return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
