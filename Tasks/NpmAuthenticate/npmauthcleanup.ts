import * as util from 'npm-common/util';
import * as constants_1 from './constants';
import * as tl from 'vsts-task-lib/task';
import * as fs from 'fs';
import * as path from 'path';

async function run() {
    tl.setResourcePath(path.join(__dirname, 'task.json'));
    let indexFile = process.env.SAVE_NPMRC_PATH + '\\index.json';
    if (fs.existsSync(indexFile)) {
        let indexFileText = fs.readFileSync(indexFile, 'utf8');
        let jsonObject = JSON.parse(indexFileText);
        let npmrcIndex = JSON.stringify(jsonObject[tl.getInput(constants_1.NpmTaskInput.WorkingDir)]);
        util.restoreFileWithName(tl.getInput(constants_1.NpmTaskInput.WorkingDir), npmrcIndex, process.env.SAVE_NPMRC_PATH);
        console.log(tl.loc("UndidChangesToNpmrc", tl.getInput(constants_1.NpmTaskInput.WorkingDir)));
        if (fs.readdirSync(process.env.SAVE_NPMRC_PATH).length == 1) {
            tl.rmRF(process.env.NPM_AUTHENTICATE_TEMP_DIRECTORY);
        }
    }
    else {
        console.log(tl.loc("NoIndex.jsonFile"));
    }
}
run();
