import tl = require('azure-pipelines-task-lib/task');
import utils = require('../utils');
import constants = require('../constants');
import tr = require("azure-pipelines-task-lib/toolrunner");
import { executeJestCommand } from '../testLibExecutor';

//Jest command like >set JEST_JUNIT_OUTPUT_NAME=TEST-Jest0-junit.xml
//>npx jest --ci --reporters=default --reporters=jest-junit -t "JestTestName"
export async function executeJestTests(testsToBeExecuted: string[]): Promise<number> {

    let finalStatus = 0; 
    let jestNpm = tl.which("npm", true);
    await executeJestCommand(jestNpm, constants.INSTALL_JESTJUNIT);

    //testsToBeExecuted: DescribeD TestH.DescribeD TestH,DescribeD TestG.DescribeD TestG,DescribeC TestF.DescribeC TestF,DescribeC TestE.DescribeC TestE,DescribeB TestD.DescribeB TestD,DescribeB TestC.DescribeB TestC,DescribeA TestB.DescribeA TestB,DescribeA TestA.DescribeA TestA
    let jestNpx = tl.which("npx", true);
    let i = 0;
    for (let tests of testsToBeExecuted) {
        const JestTestName = utils.separateJestTestName(tests);
        try {
            let junitFileName: string = `TEST-Jest${i}-junit.xml`;
            tl.setVariable('JEST_JUNIT_OUTPUT_NAME', junitFileName);
            let junitName = tl.getVariable('JEST_JUNIT_OUTPUT_NAME');
            tl.debug(`Junit Filename ${junitName} executed successfully.`);
          
            const jestCommand = `jest --ci --reporters=default --reporters=jest-junit -t "${JestTestName}"`;
            const status = await executeJestCommand(jestNpx, jestCommand);
            if (status != 0) {
                finalStatus = 1;
            }
            tl.debug(`Test case ${JestTestName} executed successfully.`);
        } catch (error) {
            tl.debug(`Error executing ${JestTestName} test case: ${error}`);
            finalStatus = 1;
        }
        i++;
    }
    return finalStatus;
}