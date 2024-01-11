import { spawn } from './testexecutor'
import tl = require('azure-pipelines-task-lib/task');

export async function executegradletests(testsToBeExecuted: string[]) {

    // const { testsToRun = [], reportFormat } = input

    const executable = 'gradle'
    const args = []

    const testcase1 = tl.getInput('testCase1:fqn');
    const testcase2 = tl.getInput('testCase2:fqn');
    const testcase3 = tl.getInput('testCase3:fqn');

    const testsToRun = [testcase1,testcase2,testcase3];
    console.log('testsToRun: ' + testsToRun);

    args.push('test');

    for (const testcase of testsToBeExecuted) {
        args.push('--tests=' + testcase);       
    }

    //const quotedArgs = args.map((arg) => (arg.includes(' ') ? `'${arg}'` : arg))
    //console.log('Running tests with gradle using command: ${[executable, ...quotedArgs].join()}');
    const { status, error } = await spawn(executable, args)
    if (error) {
        console.error(error)
    }

    return { exitCode: status ?? 1 }
}