// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import * as zlib from 'zlib';

import { ArtifactItem, IArtifactProvider, ItemType } from 'artifact-engine/Models';
import { ArtifactItemStore } from 'artifact-engine/Store/artifactItemStore';
import { IRequestHandler, IRequestOptions } from 'artifact-engine/Providers/typed-rest-client/Interfaces';
import { WebClientFactory } from 'artifact-engine/Providers/webClientFactory';

interface JenkinsArtifact {
    relativePath: unknown;
}

interface JenkinsArtifactResponse {
    artifacts: JenkinsArtifact[];
}

export function createJenkinsArtifactItems(responseBody: string, artifactBaseUrl: string): ArtifactItem[] {
    const response: JenkinsArtifactResponse = JSON.parse(responseBody);
    if (!response || !Array.isArray(response.artifacts)) {
        throw new Error('The Jenkins artifact response does not contain an artifacts array.');
    }

    const baseUrl = new URL(ensureTrailingSlash(artifactBaseUrl));
    return response.artifacts.map((artifact: JenkinsArtifact) => {
        const relativePath = validateRelativePath(artifact.relativePath);
        const encodedPath = relativePath.split('/').map(segment => encodeURIComponent(segment)).join('/');
        const downloadUrl = new URL(encodedPath, baseUrl);

        if (downloadUrl.origin !== baseUrl.origin) {
            throw new Error(`Jenkins artifact URL must use the configured Jenkins origin: ${relativePath}`);
        }

        const item = new ArtifactItem();
        item.path = relativePath;
        item.itemType = ItemType.File;
        item.metadata = {
            downloadUrl: downloadUrl.toString()
        };
        return item;
    });
}

export class JenkinsArtifactProvider implements IArtifactProvider {
    public artifactItemStore: ArtifactItemStore;
    private readonly webClient: any;

    public constructor(
        private readonly rootItemsLocation: string,
        private readonly artifactBaseUrl: string,
        handler: IRequestHandler,
        requestOptions?: IRequestOptions) {

        this.webClient = WebClientFactory.getClient(
            [handler],
            Object.assign({}, requestOptions, { allowRedirects: false }));
    }

    public getRootItems(): Promise<ArtifactItem[]> {
        const rootItem = new ArtifactItem();
        rootItem.metadata = { downloadUrl: this.rootItemsLocation };
        rootItem.path = '';
        rootItem.itemType = ItemType.Folder;
        return Promise.resolve([rootItem]);
    }

    public async getArtifactItems(artifactItem: ArtifactItem): Promise<ArtifactItem[]> {
        const response = await this.webClient.get(
            artifactItem.metadata['downloadUrl'],
            { Accept: 'application/json' });
        const responseBody = await response.readBody();
        return createJenkinsArtifactItems(responseBody, this.artifactBaseUrl);
    }

    public getArtifactItem(artifactItem: ArtifactItem): Promise<NodeJS.ReadableStream> {
        return new Promise<NodeJS.ReadableStream>((resolve, reject) => {
            if (!artifactItem.metadata || !artifactItem.metadata['downloadUrl']) {
                reject(new Error('No downloadUrl available to download the item.'));
                return;
            }

            let downloadSize = 0;
            let zipStream: zlib.Unzip;
            const additionalHeaders: { [key: string]: string } = {};

            if (artifactItem.contentType) {
                additionalHeaders['Accept'] = artifactItem.contentType;
            }

            this.webClient.get(artifactItem.metadata['downloadUrl'], additionalHeaders).then(response => {
                response.message.on('data', chunk => {
                    downloadSize += chunk.length;
                });
                response.message.on('end', () => {
                    this.artifactItemStore.updateDownloadSize(artifactItem, downloadSize);
                });
                response.message.on('error', error => {
                    if (zipStream) {
                        zipStream.destroy(error);
                    }
                    reject(error);
                });

                if (response.message.headers['content-encoding'] === 'gzip') {
                    try {
                        zipStream = zlib.createUnzip();
                        resolve(response.message.pipe(zipStream));
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    resolve(response.message);
                }
            }, reject);
        });
    }

    public putArtifactItem(): Promise<ArtifactItem> {
        throw new Error('Not implemented');
    }

    public dispose(): void {
        this.webClient.dispose();
    }
}

function validateRelativePath(value: unknown): string {
    if (typeof value !== 'string' || value.length === 0 || value.indexOf('\0') >= 0) {
        throw new Error('Jenkins returned an invalid artifact path.');
    }

    if (value.indexOf('\\') >= 0 || value.startsWith('/') || /^[a-zA-Z]:/.test(value)) {
        throw new Error(`Jenkins returned an absolute artifact path: ${value}`);
    }

    const segments = value.split('/');
    if (segments.some(segment => segment === '.' || segment === '..')) {
        throw new Error(`Jenkins returned an artifact path outside the download root: ${value}`);
    }

    return value;
}

function ensureTrailingSlash(value: string): string {
    return value.endsWith('/') ? value : `${value}/`;
}
