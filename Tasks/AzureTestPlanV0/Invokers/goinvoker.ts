import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');

export async function executeGoTests(testsToBeExecuted: string[]): Promise<number> {

    //Go execution will be added
    /*executable = go;
    args = test, ./...  
    spawn*/

    console.log("Go changes123");  
    return 1;
}

