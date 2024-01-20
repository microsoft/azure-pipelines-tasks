import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');

export async function executemaventests(testsToBeExecuted: string[]) {

    //maven command like "mvn test -Dtest=<package.className#testName>,<package.className#testName1>"

    const executable = 'mvn'
    const args = []
    const testsToRun =[]

    for (let tests of testsToBeExecuted) {
        const modifiedTest = utils.replaceLastDotWithHash(tests);
        testsToRun.push(modifiedTest);
    }

    if (testsToRun.length > 0)
    {
        const testsList = testsToRun.join(',')
        const dtest = '-Dtest=';
        const newArgs = dtest + testsList;

            args.push('test');
            args.push(newArgs);
    }

    tl.debug("Executing java maven tests with executable : " + executable);
    tl.debug("Executing java maven tests with args :" + args);

    //const quotedArgs = args.map((arg) => (arg.includes(' ') ? `'${arg}'` : arg))
    //console.log('Running tests with maven using command: ${[executable, ...quotedArgs].join()}');
        const { status, error } = await spawn(executable, args)
        if (error) {
            console.error(error)
        }

        return { exitCode: status ?? 1 }
    }