import * as fs from 'fs';
import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const userM2SettingsXmlPath: string = tl.getTaskVariable('userM2SettingsXmlPath');
        const backupUserM2SettingsFilePath: string = tl.getTaskVariable('backupUserM2SettingsFilePath');
        const originalUserM2SettingsFileMode: string = tl.getTaskVariable('originalUserM2SettingsFileMode');

        if (userM2SettingsXmlPath && tl.exist(userM2SettingsXmlPath)) {
            tl.rmRF(userM2SettingsXmlPath);
            tl.debug('Deleted user m2 settings.xml file: ' + userM2SettingsXmlPath);

            if (backupUserM2SettingsFilePath && tl.exist(backupUserM2SettingsFilePath)) {
                tl.mv(backupUserM2SettingsFilePath, userM2SettingsXmlPath);
                if (originalUserM2SettingsFileMode && !tl.osType().match(/^Win/)) {
                    try {
                        fs.chmodSync(userM2SettingsXmlPath, parseInt(originalUserM2SettingsFileMode, 8));
                    } catch (err) {
                        tl.warning(tl.loc('Warning_ChmodFailed', userM2SettingsXmlPath, originalUserM2SettingsFileMode, (err && err.message) ? err.message : err));
                    }
                }
                tl.debug('Restored old user m2 settings.xml file: ' + backupUserM2SettingsFilePath);
            }
        }
    } catch (err) {
        tl.warning(tl.loc('Error_FailedCleanupM2', err));
    }
}

run();
