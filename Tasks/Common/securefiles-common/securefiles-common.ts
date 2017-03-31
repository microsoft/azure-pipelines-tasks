import fs = require('fs');
import path = require('path');
import Q = require('q');
import tl = require('vsts-task-lib/task');
import vsts = require('vso-node-api');

export class SecureFileHelpers {
    serverConnection: vsts.WebApi;

    constructor() {
        let serverUrl: string = tl.getEndpointUrl('SYSTEMVSSCONNECTION', false);
        let serverCreds: string = tl.getEndpointAuthorizationParameter('SYSTEMVSSCONNECTION', 'ACCESSTOKEN', false);
        let authHandler = vsts.getPersonalAccessTokenHandler(serverCreds);

        this.serverConnection = new vsts.WebApi(serverUrl, authHandler);
    }

    /**
     * Download secure file contents to a temporary location for the build
     * @param secureFileId 
     */
    downloadSecureFile(secureFileId: string): string {
        let stream: Promise<NodeJS.ReadableStream> = this.serverConnection.getTaskAgentApi().downloadSecureFile(
            tl.getVariable('SYSTEM_TEAMPROJECT'),
            secureFileId,
            tl.getSecureFileTicket(secureFileId));

        let tempDownloadPath: string = this.getSecureFileTempDownloadPath(secureFileId);
        tl.debug('Downloading secure file contents to: ' + tempDownloadPath);
        fs.writeFileSync(tempDownloadPath, stream);
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



