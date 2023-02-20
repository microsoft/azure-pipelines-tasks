import * as taskLib from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';

export function getDirContent(directoryPath: string) {
    try {
        const files = fs.readdirSync(directoryPath);

        files.forEach((file) => {
            taskLib.debug('Found file = ' + file);
        });

        return files;

    } catch (err) {
        taskLib.warning(`Unable to scan directory: ${directoryPath}:\n` + err);
    }
}
