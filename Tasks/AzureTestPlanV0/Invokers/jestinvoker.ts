import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import { executeJestCommand } from '../testLibExecutor';

//Jest command like: >set JEST_JUNIT_OUTPUT_NAME=TEST-Jest0-junit.xml
//>npx jest --ci --reporters=default --reporters=jest-junit -t "JestTestName"
export async function executeJestTests(testsToBeExecuted: string[]): Promise<number> {

    //Jest-Junit Link:https://github.com/jest-community/jest-junit
    let finalStatus = 0;
    let npmPath = tl.which("npm", true);
    try {
        await executeJestCommand(npmPath, constants.INSTALL_JESTJUNIT);
    } catch (error) {
        tl.error(`Error installing Jest-Junit: ${error}`);
        return 1; 
    }
    //testToBeExecuted: <TestSuiteName1> <TestCase1>. <TestSuiteName1> <TestCase1>,<TestSuiteName2> <TestCase3>. <TestSuiteName2> <TestCase3>
    let npxPath = tl.which("npx", true);
    let i = 0;
    for (let tests of testsToBeExecuted) {
        const JestTestName = utils.separateJestTestName(tests);
        try {
            let junitFileName: string = `TEST-Jest${i}-junit.xml`;
            try {
                tl.setVariable('JEST_JUNIT_OUTPUT_NAME', junitFileName);
                let junitName = tl.getVariable('JEST_JUNIT_OUTPUT_NAME');
                if (junitName !== junitFileName) {
                    throw new Error(`Retrieved JEST_JUNIT_OUTPUT_NAME (${junitName}) does not match the set value (${junitFileName})`);
                }
                tl.debug(`Junit Filename ${junitName} environment set and retrieved successfully.`);
            } catch (error) {
                tl.error(`Error setting or getting JEST_JUNIT_OUTPUT_NAME variable: ${error}`);
                finalStatus = 1;
                continue;
            }

            const jestCommand = `jest --ci --reporters=default --reporters=jest-junit -t "${JestTestName}"`;
            const status = await executeJestCommand(npxPath, jestCommand);
            if (status != 0) {
                finalStatus = 1;
            }
            tl.debug(`Test case ${JestTestName} executed successfully.`);
        } catch (error) {
            tl.error(`Error executing ${JestTestName} test case: ${error}`);
            finalStatus = 1;
        }
        i++;
    }
    return finalStatus;
}