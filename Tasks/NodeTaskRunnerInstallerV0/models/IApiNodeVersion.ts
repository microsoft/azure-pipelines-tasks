/**
 * Node versions interface.
 * See https://nodejs.org/dist/index.json
 */
export interface IApiNodeVersion {
    version: string;
    date: Date;
    files: string[];
    npm?: string;
    v8: string;
    uv?: string;
    zlib?: string;
    openssl?: string;
    modules?: string;
    lts: boolean | string;
    security: boolean;
}
