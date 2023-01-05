import * as util from 'azure-pipelines-tasks-packaging-common-v3/util';
import * as constants from './constants';
import * as tl from 'azure-pipelines-task-lib/task';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    const npmrcPath = tl.getVariable("SAVE_NPMRC_PATH");
    let indexFile = npmrcPath && path.join(npmrcPath, 'index.json');
    if (indexFile && tl.exist(indexFile)) {
        let indexFileText = fs.readFileSync(indexFile, 'utf8');
        let jsonObject = JSON.parse(indexFileText);
        let npmrcIndex = JSON.stringify(jsonObject[tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile)]);
        util.restoreFileWithName(tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile), npmrcIndex, tl.getVariable("SAVE_NPMRC_PATH"));
        console.log(tl.loc("RevertedChangesToNpmrc", tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile)));
        if (fs.readdirSync(tl.getVariable("SAVE_NPMRC_PATH")).length == 1) {
            tl.rmRF(tl.getVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY"));
        }
    }
    else {
        console.log(tl.loc("NoIndexJsonFile"));
    }
}
run();
