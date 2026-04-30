import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const userM2SettingsXmlPath: string = tl.getTaskVariable('userM2SettingsXmlPath');
        const backupUserM2SettingsFilePath: string = tl.getTaskVariable('backupUserM2SettingsFilePath');

        if (userM2SettingsXmlPath && tl.exist(userM2SettingsXmlPath)) {
            tl.rmRF(userM2SettingsXmlPath);
            tl.debug('Deleted user m2 settings.xml file: ' + userM2SettingsXmlPath);

            if (backupUserM2SettingsFilePath && tl.exist(backupUserM2SettingsFilePath)) {
                tl.mv(backupUserM2SettingsFilePath, userM2SettingsXmlPath);
                tl.debug('Restored old user m2 settings.xml file: ' + backupUserM2SettingsFilePath);
            }
        }
    } catch (err) {
        tl.warning(tl.loc('Error_FailedCleanupM2', err));
    }
}

run();
