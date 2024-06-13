import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import tr = require("azure-pipelines-task-lib/toolrunner");
import { executeGoCommand } from '../testLibExecutor';

//GO command like "gotestsum --junitfile TEST-Go<i>-junit.xml -- <filepath> -v -run ^<TestName>$"
export async function executeGoTests(testsToBeExecuted: string[]): Promise<number> {

    let goPath = tl.which("go", true);
    await executeGoCommand(goPath, constants.INSTALL_GOTESTSUM);
    tl.debug("Installed Gotestsum");

    //testsToBeExecuted: go.mod/01-normal/normal.Test1,go.mod/01-normal/normal.Test11,go.mod/04-testmain.Test1,go.mod/05-parallel.TestSumParalel
    goPath = tl.which("gotestsum", true);
    let i = 0;
    for (let tests of testsToBeExecuted) {
        try {
            const GoTestPath = utils.separateGoPath(tests);
            const GoTestName = utils.separateGoTestName(tests);
            const argument = `--junitfile TEST-Go${i}-junit.xml -- ${GoTestPath} -v -run ^${GoTestName}$`;
            await executeGoCommand(goPath, argument);
            tl.debug("Tests Run Successfully");
        } catch (error) {
            console.error(`Error executing test case:`, error);
        }
        i++;
    }
    return 0;
}