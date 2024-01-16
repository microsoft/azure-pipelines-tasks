import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');

export async function executegradletests(testsToBeExecuted: string[]) {

    const executable = 'gradle'
    const args = []

    args.push('test');  

    for (let testcase of testsToBeExecuted) {
        args.push(testcase);
    }

    tl.debug("Executing gradle tests with executable : " + executable);
    tl.debug("Executing gradle tests with args :" + args);

    const { status, error } = await spawn(executable, args)
    if (error) {
        console.error(error)
    }

    return { exitCode: status ?? 1 }
}