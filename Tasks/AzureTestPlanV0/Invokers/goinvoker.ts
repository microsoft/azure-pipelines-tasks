import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import { executeGo, executeGotestsum } from '../testexecutor';

//GO command like "gotestsum --junitfile TEST-Go<i>-junit.xml -- <filepath> -v -run ^<TestName>$"
export async function executeGoTests
    (testsToBeExecuted: string[]): Promise<number> {

    let command = constants.INSTALL;
    let argument = constants.GOTESTSUM_PACKAGE;
    const installGotestsum = await executeGo(command, argument);
    tl.debug("Installing Gotestsum : " + installGotestsum);

//testsToBeExecuted: go.mod/01-normal/normal.Test1,go.mod/01-normal/normal.Test11,go.mod/04-testmain.Test1,go.mod/05-parallel.TestSumParalel
    let i = 0;
    for (let tests of testsToBeExecuted) {
        try {
            const modifiedPath = utils.separatePath(tests);
            const modifiedTest = utils.separateTestName(tests);
            const command = constants.GOTESTSUM_JUNITFILE;    
            const argument = `TEST-Go${i}-junit.xml -- ${modifiedPath} -v -run ^${modifiedTest}$ `;
            const testsToRun = await executeGotestsum(command, argument);
            tl.debug("Tests to Run : " + testsToRun);
        } catch (error) {
            console.error(`Error executing test case:`, error);
        }
        i++;
    }
    return 0;
}