import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib/task';

async function run() {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));

        const userGradlePropertiesPath: string = tl.getTaskVariable('userGradlePropertiesPath');
        const backupUserGradlePropertiesFilePath: string = tl.getTaskVariable('backupUserGradlePropertiesFilePath');

        if (userGradlePropertiesPath && tl.exist(userGradlePropertiesPath)) {
            tl.rmRF(userGradlePropertiesPath);
            tl.debug('Deleted user gradle.properties file: ' + userGradlePropertiesPath);

            if (backupUserGradlePropertiesFilePath && tl.exist(backupUserGradlePropertiesFilePath)) {
                tl.mv(backupUserGradlePropertiesFilePath, userGradlePropertiesPath);
                tl.debug('Restored old user gradle.properties file: ' + backupUserGradlePropertiesFilePath);
            }
        }
    } catch (err) {
        tl.warning(tl.loc('Error_FailedCleanupGradle', err));
    }
}

run();
