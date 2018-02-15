import * as tl from "vsts-task-lib/task";

export class SecureFileHelpers {

    constructor() {
        tl.debug('Mock SecureFileHelpers constructor');
    }

    async downloadSecureFile(secureFileId: string) {
        tl.debug('Mock downloadSecureFile with id = ' + secureFileId);
        let fileName: string = secureFileId + '.filename';
        let tempDownloadPath: string = tl.getVariable('Agent.TempDirectory') + '/' + fileName;
        return tempDownloadPath;
    }

    deleteSecureFile(secureFileId: string) {
        tl.debug('Mock deleteSecureFile with id = ' + secureFileId);
    }
}