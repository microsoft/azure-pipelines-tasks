import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
export async function executegradletests(testsToBeExecuted: string[]) {

    //public doc link: https://docs.gradle.org/current/userguide/command_line_interface.html
    //gradle command like "gradle test --tests=<package.className.testName> --tests=<package.className.testName>"

    const executable = constants.GRADLE_EXECUTABLE;
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
        tl.error("Error executing pytest command" + error);
        tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFailTaskOnExecutingTests'));
    }

    return { exitCode: status ?? 1 }
}