import { spawn } from '../testexecutor'
import tl = require('azure-pipelines-task-lib/task');
import constants = require('../constants');

export async function executepythontests(testsToBeExecuted: string[]) {

    //public doc link: https://docs.pytest.org/en/7.1.x/how-to/usage.html#specifying-which-tests-to-run
    //pytest command like "pytest -v <package.className.testName1> <package.className.testName2> --junitxml=junit.xml"

    const executable = constants.PYTEST_EXECUTABLE;
    let args: string[] = [];

    for (let testcase of testsToBeExecuted) {
        args.push(testcase);
    }

    args.push('--junitxml=junit.xml')

    tl.debug("Executing python tests with executable : " + executable);
    tl.debug("Executing python tests with args :" + args);

    const { status, error } = await spawn(executable, args)

    if (error) {
        tl.error("Error executing pytest command" + error);
        tl.setResult(tl.TaskResult.Failed, tl.loc('ErrorFailTaskOnExecutingTests'));
    }

    return { exitCode: status ?? 1 }
}