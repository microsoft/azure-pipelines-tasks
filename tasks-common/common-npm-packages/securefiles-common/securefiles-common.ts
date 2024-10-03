import * as fs from 'fs';
import * as Q from 'q';
import * as tl from 'azure-pipelines-task-lib/task';
import { getPersonalAccessTokenHandler, WebApi } from 'azure-devops-node-api';
import { IRequestOptions } from "azure-devops-node-api/interfaces/common/VsoBaseInterfaces";

export class SecureFileHelpers {
    serverConnection: WebApi;

    constructor(retryCount?: number, socketTimeout?: number) {
        const serverUrl: string = tl.getVariable('System.TeamFoundationCollectionUri');
        const serverCreds: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
        const authHandler = getPersonalAccessTokenHandler(serverCreds, true);

        const maxRetries = retryCount && retryCount >= 0 ? retryCount : 5; // Default to 5 if not specified
        tl.debug('Secure file retry count set to: ' + maxRetries);

        const proxy = tl.getHttpProxyConfiguration();
        let options: IRequestOptions = {
            allowRetries: true,
            maxRetries,
            socketTimeout
        };

        if (proxy) {
            options = { ...options, proxy, ignoreSslError: true };
        };

        this.serverConnection = new WebApi(serverUrl, authHandler, options);
    }

    /**
     * Download secure file contents to a temporary location for the build
     * @param secureFileId
     */
    async downloadSecureFile(secureFileId: string): Promise<string> {
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
    deleteSecureFile(secureFileId: string): void {
        const tempDownloadPath: string = this.getSecureFileTempDownloadPath(secureFileId);
        if (tl.exist(tempDownloadPath)) {
            tl.debug('Deleting secure file at: ' + tempDownloadPath);
            tl.rmRF(tempDownloadPath);
        }
    }

    /**
     * Returns the temporary download location for the secure file
     * @param secureFileId
     */
    getSecureFileTempDownloadPath(secureFileId: string): string {
        const fileName: string = tl.getSecureFileName(secureFileId);
        return tl.resolve(tl.getVariable('Agent.TempDirectory'), fileName);
    }
}



