import tl = require('azure-pipelines-task-lib/task');
import utils = require('../../Common/utils');
import constants = require('../../Common/constants');
import { execGradleBuild } from '../../OldAutomatedFlow/testLibExecutor';

export async function executeGradleTests(testsToBeExecuted: string[], gradleFilePath?: string): Promise<number> {

    //public doc link: https://docs.gradle.org/current/userguide/command_line_interface.html
    //gradle command like "gradlew clean test --tests <package.className.testName> --tests <package.className.testName>"

    const executable = constants.GRADLE_EXECUTABLE;
    let args: string[] = [];

    if (gradleFilePath) {
        args.push('-b', gradleFilePath);
    }

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

    return status ?? 1;
}