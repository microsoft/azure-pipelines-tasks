import * as util from 'azure-pipelines-tasks-packaging-common-v3/util';
import * as constants from './constants';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const npmrcPath = tl.getVariable("SAVE_NPMRC_PATH");
    const workingFilePath = tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile);
    let indexFile = npmrcPath && path.join(npmrcPath, 'index.json');
    if (indexFile && tl.exist(indexFile) && tl.exist(workingFilePath)) {
        let indexFileText = fs.readFileSync(indexFile, 'utf8');
        let jsonObject = JSON.parse(indexFileText);
        let npmrcIndex = JSON.stringify(jsonObject[tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile)]);
        util.restoreFileWithName(workingFilePath, npmrcIndex, tl.getVariable("SAVE_NPMRC_PATH"));
        console.log(tl.loc("RevertedChangesToNpmrc", tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile)));
        const tempDirectoryPath = tl.getVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY");
        if (tl.exist(tempDirectoryPath) && fs.readdirSync(tl.getVariable("SAVE_NPMRC_PATH")).length == 1) {
            tl.rmRF(tempDirectoryPath);
        }
    }
    else {
        console.log(tl.loc("NoIndexJsonFile"));
    }
}
run();
