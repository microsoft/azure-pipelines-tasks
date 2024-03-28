import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import { execGradleBuild } from '../testLibExecutor';

export async function executegradletests(testsToBeExecuted: string[]) {

    //public doc link: https://docs.gradle.org/current/userguide/command_line_interface.html
    //gradle command like "gradlew clean test --tests <package.className.testName> --tests <package.className.testName>"

    const executable = constants.GRADLE_EXECUTABLE;
    let args: string[] = [];

    args.push('test');  

    for (let testcase of testsToBeExecuted) {
        // in some cases found that gradle is including () in test name
        testcase = utils.removeParenthesesFromEnd(testcase);
        args.push('--tests');
        args.push(testcase);
    }

    tl.debug("Executing gradle tests with executable : " + executable);
    tl.debug("Executing gradle tests with args :" + args);

    var status = await execGradleBuild(args);

    return { exitCode: status ?? 1 }
}