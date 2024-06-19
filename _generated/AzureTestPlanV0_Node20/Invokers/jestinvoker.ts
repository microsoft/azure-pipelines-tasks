import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');

export async function executeJestTests(testsToBeExecuted: string[]): Promise<number> {

    // jest execution will be added
    /*executable = npm
    args = test
    */

    console.log("jest changes1");
    return 1;
}