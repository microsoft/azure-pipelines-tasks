/*import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import { spawn, SpawnResult } from '../testexecutor';



export async function executeGoTests(testsToBeExecuted: string[]): Promise<number> {    */

    //Go execution will be added
    /*executable = go;
    args = test, ./...  
    spawn*/

   // console.log("Go changes1");
    //return 1;

/*   
    const args = ['test', './...'];

    tl.debug("Executing go tests with args: " + args);

    const { status, error } = await runGotestCommand(args);

    

    if (error) {
        tl.error("Error executing pytest command: " + error.message);
        return 1;
    }

    return status ?? 1;
}

async function runGotestCommand(args: string[]): Promise<SpawnResult> {
    const executable = constants.GO_EXECUTABLE;

    try {
        const { status, error, stdout } = await spawn(executable, args);
        console.log("pytest stdout:", stdout);

        if (status === 0) {
            return { status, stdout };
        } else {
            return { status, error };
        }
    } catch (err) {
        return { status: 1, error: err };
    }
}  
*/

import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import { spawn, SpawnResult } from '../testexecutor';



const executable = constants.GO_EXECUTABLE;
let args: string[] = [];
export async function executeGoTests(testsToBeExecuted: string[]): Promise<number> {
    //Go execution will be added
    /*executable = go;
    args = test, ./...  
    spawn*/
    //const executable = constants.GO_EXECUTABLE;

    for (let i = 0; i < testsToBeExecuted.length; i++) {
        if (i == 2) {
            let testcase = testsToBeExecuted[i];
            // in some cases found that gradle is including () in test name
            const modifiedTest1 = utils.separateString(testcase);
            const modifiedTest2 = utils.testName(testcase);
            args = []; // Reset args for each test case
            args.push('test');
            args.push('-v');
            args.push(modifiedTest1);
            args.push('-run');
            args.push(modifiedTest2);
            

            tl.debug("Executing go test with args: " + args);
            const { status, error } = await runGotestCommand(args);

            args = [];

            if (error) {
                tl.error("Error executing gotest command: " + error.message);
                return 1; // Return on error
            }

            // You can handle the status or other actions here if needed
            if (status !== 0) {
                return status; // Return non-zero status if the test failed
            }
        }
    }

    return 0; // Return 0 if all tests passed
}

async function runGotestCommand(args: string[]): Promise<SpawnResult> {
    

    try {
        const { status, error, stdout } = await spawn(executable, args);
        console.log("gotest stdout:", stdout);

        if (status === 0) {
            return { status, stdout };
        } else {
            return { status, error };
        }
    } catch (err) {
        return { status: 1, error: err };
    }
}
