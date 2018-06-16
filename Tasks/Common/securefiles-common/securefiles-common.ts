import fs = require('fs');
import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');
import vsts = require('vso-node-api');
import { IRequestOptions } from 'vso-node-api/interfaces/common/VsoBaseInterfaces';

export class SecureFileHelpers {
    serverConnection: vsts.WebApi;

    constructor() {
        let serverUrl: string = tl.getVariable('System.TeamFoundationCollectionUri');
        let serverCreds: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
        let authHandler = vsts.getPersonalAccessTokenHandler(serverCreds);

        const proxy = tl.getHttpProxyConfiguration();
        const options = proxy ? { proxy, ignoreSslError: true } : undefined;

        this.serverConnection = new vsts.WebApi(serverUrl, authHandler, options);
    }

    /**
     * Download secure file contents to a temporary location for the build
     * @param secureFileId
     */
    async downloadSecureFile(secureFileId: string) {
        const tempDownloadPath: string = this.getSecureFileTempDownloadPath(secureFileId);

        tl.debug('Downloading secure file contents to: ' + tempDownloadPath);
        const file: NodeJS.WritableStream = fs.createWriteStream(tempDownloadPath);

        const agentApi = await this.serverConnection.getTaskAgentApi();

        const ticket = tl.getSecureFileTicket(secureFileId);
        if (!ticket) {
            // Workaround bug #7491. tl.loc only works if the consuming tasks define the resource string.
            throw new Error(`Download ticket for SecureFileId ${secureFileId} not found.`);
        }

        const stream = (await agentApi.downloadSecureFile(
            tl.getVariable('SYSTEM.TEAMPROJECT'), secureFileId, ticket, false)).pipe(file);

        const defer = Q.defer();
        stream.on('finish', () => {
            defer.resolve();
        });
        await defer.promise;
        tl.debug('Downloaded secure file contents to: ' + tempDownloadPath);
        return tempDownloadPath;
    }

    /**
     * Delete secure file from the temporary location for the build
     * @param secureFileId
     */
    deleteSecureFile(secureFileId: string) {
        let tempDownloadPath: string = this.getSecureFileTempDownloadPath(secureFileId);
        if (tl.exist(tempDownloadPath)) {
            tl.debug('Deleting secure file at: ' + tempDownloadPath);
            tl.rmRF(tempDownloadPath);
        }
    }

    /**
     * Returns the temporary download location for the secure file
     * @param secureFileId
     */
    getSecureFileTempDownloadPath(secureFileId: string) {
        let fileName: string = tl.getSecureFileName(secureFileId);
        let tempDownloadPath: string = tl.resolve(tl.getVariable('Agent.TempDirectory'), fileName);
        return tempDownloadPath;
    }
}



