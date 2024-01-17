import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');

function removeParenthesesFromEnd(inputString) {
    // Check if the string ends with parentheses
    if (inputString.endsWith('()')) {
        // Remove the parentheses from the end
        return inputString.slice(0, -2);
    } else {
        // If no parentheses at the end, return the original string
        return inputString;
    }
}
export async function executegradletests(testsToBeExecuted: string[]) {

    const executable = 'gradle'
    const args = []

    args.push('test');  

    for (let testcase of testsToBeExecuted) {

        // in some cases found that gradle is including () in test name
        removeParenthesesFromEnd(testcase);
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