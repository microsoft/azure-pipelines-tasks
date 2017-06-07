import * as tl from 'vsts-task-lib/task';
import * as fs from 'fs';
import * as path from 'path';

import {BuildArtifact} from 'vso-node-api/interfaces/BuildInterfaces';
import {FileContainerItem, ContainerItemType} from 'vso-node-api/interfaces/FileContainerInterfaces';
import {IFileContainerApi} from 'vso-node-api/FileContainerApi';
import {WebApi, getHandlerFromToken} from 'vso-node-api/WebApi';

import {DownloadItem, download} from './Downloader';
import {ArtifactProvider} from './ArtifactProvider';

export class FileContainerProvider implements ArtifactProvider {
    public supportsArtifactType(artifactType: string): boolean {
        return !!artifactType && artifactType.toLowerCase() === "container";
    }

    public async downloadArtifact(artifact: BuildArtifact, targetPath: string): Promise<void> {
        if (!artifact || !artifact.resource || !artifact.resource.data) {
            throw new Error(tl.loc("FileContainerInvalidArtifact"));
        }

        let containerParts: string[] = artifact.resource.data.split('/', 3);
        if (containerParts.length !== 3) {
            throw new Error(tl.loc("FileContainerInvalidArtifactData"));
        }

        let containerId: number = parseInt(containerParts[1]);
        let containerPath: string = containerParts[2];

        let accessToken = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'AccessToken', false);
		let credentialHandler = getHandlerFromToken(accessToken);
        let collectionUrl = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
        let vssConnection = new WebApi(collectionUrl, credentialHandler);

        let fileContainerApi = vssConnection.getFileContainerApi();

        // get all items
        let items: FileContainerItem[] = await fileContainerApi.getItems(containerId, null, containerPath, false, null, null, false, false);

        // ignore folders
        items = items.filter(item => item.itemType === ContainerItemType.File);
        tl.debug(`Found ${items.length} File items in #/${containerId}/${containerPath}`);

        let downloadItems: DownloadItem<FileContainerItem>[] = items.map((item) => {
            return { 
                relativePath: item.path,
                data: item
            };
        })

        // download the items
        await download(downloadItems, targetPath, 8, (item: DownloadItem<FileContainerItem>) => new Promise(async (resolve, reject) => {
            try {
                let downloadFilename = item.data.path.substring(item.data.path.lastIndexOf("/") + 1);
                let itemResponse = await fileContainerApi.getItem(containerId, null, item.data.path, downloadFilename);
                if (itemResponse.statusCode === 200) {
                    resolve(itemResponse.result);
                }
                else {
                    // TODO: decide whether to retry or bail
                    reject(itemResponse);
                }
            }
            catch (err) {
                reject(err);
            }
        }));
    }
}

function getAuthToken() {
    let auth = tl.getEndpointAuthorization('SYSTEMVSSCONNECTION', false);
    if (auth.scheme.toLowerCase() === 'oauth') {
        return auth.parameters['AccessToken'];
    }
    else {
        throw new Error(tl.loc("CredentialsNotFound"))
    }
}