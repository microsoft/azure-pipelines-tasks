import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import { executeGo, executeGotestsum } from '../testexecutor';

export async function executeGoTests(testsToBeExecuted: string[]): Promise<number> {

    let command = constants.GOTESTSUM_INSTALL;
    let argument = constants.GOTESTSUM_PACKAGE;
    const installGotestsum = await executeGo(command, argument);
    console.log(installGotestsum);

    let i = 0;
    for (let tests of testsToBeExecuted) {
        try {
            const modifiedPath = utils.separatePath(tests);
            const modifiedTest = utils.separateTestName(tests);
            const command = constants.GOTESTSUM_JUNITFILE;
            const argument = `TEST-${i}.xml -- ${modifiedPath} -v -run ^${modifiedTest}$ `;
            const testsToRun = await executeGotestsum(command, argument);
            console.log(testsToRun);
        } catch (error) {
            console.error(`Error executing test case:`, error);
        }
        i++;
    }
    return 0;
}
