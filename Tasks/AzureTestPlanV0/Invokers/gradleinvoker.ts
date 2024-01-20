import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
export async function executegradletests(testsToBeExecuted: string[]) {

    //gradle command like "gradle test --tests=<package.className.testName> --tests=<package.className.testName>"

    const executable = 'gradle'
    const args = []

    args.push('test');  

    for (let testcase of testsToBeExecuted) {

        // in some cases found that gradle is including () in test name
        utils.removeParenthesesFromEnd(testcase);
        args.push('--tests=' + testcase);
    }

    tl.debug("Executing gradle tests with executable : " + executable);
    tl.debug("Executing gradle tests with args :" + args);

    const { status, error } = await spawn(executable, args)
    if (error) {
        console.error(error)
    }

    return { exitCode: status ?? 1 }
}