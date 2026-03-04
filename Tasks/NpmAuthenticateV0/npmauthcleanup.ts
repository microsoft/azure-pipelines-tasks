import * as constants from './constants';
import * as tl from 'azure-pipelines-task-lib/task';
import * as path from 'path';
import { NpmrcBackupManager } from './npmrcBackupManager';

async function run() {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const npmrcPath = tl.getVariable("SAVE_NPMRC_PATH");
    const workingFilePath = tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile);
    let indexFile = npmrcPath && path.join(npmrcPath, 'index.json');
    if (indexFile && tl.exist(indexFile) && tl.exist(workingFilePath)) {
        const backupManager = NpmrcBackupManager.fromSaveDirectory(npmrcPath);
        const restored = backupManager.restoreBackedUpFile(workingFilePath);
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
