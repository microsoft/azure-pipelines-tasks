import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import { execGradleBuild } from '../testLibExecutor';
export async function executegradletests(testsToBeExecuted: string[]) {

    //public doc link: https://docs.gradle.org/current/userguide/command_line_interface.html
    //gradle command like "gradle test --tests=<package.className.testName> --tests=<package.className.testName>"

    const executable = constants.GRADLE_EXECUTABLE;
    let args: string[] = [];

    args.push('test');  

    let testCasearg = '';

    for (let testcase of testsToBeExecuted) {

        console.log("Before Formating: " + testcase);

        // in some cases found that gradle is including () in test name
        testcase = utils.removeParenthesesFromEnd(testcase);

        console.log("After Formating: " + testcase);
        args.push('--tests');
        args.push(testcase);
        //args.push(`--tests ${testcase}`);
        console.log(args)
    }

    tl.debug("Executing gradle tests with executable : " + executable);
    tl.debug("Executing gradle tests with args :" + args);

    // const { status, error } = await spawn(executable, args)
    // if (error) {
    //     tl.error("Error executing gradle command, " + error);
    // }

    var status = await execGradleBuild(args);

    return { exitCode: status ?? 1 }
}