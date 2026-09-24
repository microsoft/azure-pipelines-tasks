import * as constants from './constants';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { FileIdentity, NpmrcBackupManager, NpmrcFileIdentityTaskVariable } from './npmrcBackupManager';

async function run() {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const npmrcPath = tl.getVariable("SAVE_NPMRC_PATH");
    const workingFilePath = tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile);
    const indexFile = npmrcPath && path.join(npmrcPath, 'index.json');
    if (indexFile && tl.exist(indexFile) && tl.exist(workingFilePath)) {
        const backupManager = NpmrcBackupManager.fromBackupDirectory(npmrcPath);
        const serializedIdentity = tl.getTaskVariable(NpmrcFileIdentityTaskVariable);
        let trustedIdentity: FileIdentity;
        try {
            trustedIdentity = serializedIdentity && JSON.parse(serializedIdentity);
        } catch {
            throw new Error(tl.loc('NpmrcChangedSinceBackup', workingFilePath));
        }
        if (!trustedIdentity
            || typeof trustedIdentity.device !== 'string'
            || typeof trustedIdentity.inode !== 'string') {
            throw new Error(tl.loc('NpmrcChangedSinceBackup', workingFilePath));
        }
        const restored = backupManager.restoreBackedUpFile(workingFilePath, trustedIdentity);
        if (restored) {
            console.log(tl.loc("RevertedChangesToNpmrc", workingFilePath));
        }
        const tempDirectoryPath = tl.getVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY");
        if (tl.exist(tempDirectoryPath) && backupManager.isOnlyIndexFileRemaining()) {
            tl.rmRF(tempDirectoryPath);
        }
    }
    else {
        console.log(tl.loc("NoIndexJsonFile"));
    }
}
run();
