import { Console } from "console";
import tl = require('azure-pipelines-task-lib/task');

export function getAutomatedTests(testPlanId: number, testSuiteIds: number[], testConfigurationId: number): string[] {


    //taking fqn of test cases from input for now
    const testcase1 = tl.getInput('testCase1:fqn');
    const testcase2 = tl.getInput('testCase2:fqn');
    const testcase3 = tl.getInput('testCase3:fqn');
    //to do: add implementation here
    return [testcase1, testcase2, testcase3];
}