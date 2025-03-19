import fs = require('fs');
import assert = require('assert');
import path = require('path');
import ttm = require('azure-pipelines-task-lib/mock-test');
const tl = require('azure-pipelines-task-lib/task');
import { TestPlanData } from '../testPlanData';
import { newAutomatedTestsFlow } from '../Automated Flow/automatedFlow';

describe('AzureTestPlan Suite', function () {
    this.timeout(10000);

    const originalGetInput = tl.getInput;
    const originalGetBoolInput = tl.getBoolInput;

    beforeEach(() => {
        tl.getInput = (key, required) => key === 'testLanguageInput' ? 'Python' : null;
        tl.getBoolInput = () => false;
    });

    afterEach(() => {
        tl.getInput = originalGetInput;
        tl.getBoolInput = originalGetBoolInput;
    });

    it('Check if runs fine', (done: Mocha.Done) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0SampleTest.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.stdOutContained(`Test Selector selected`),
                `Should have looked Test Selector`);

            assert(tr.stdOutContained(`Test Plan Id:`),
                `Should have looked for Test Plan Id`);

            assert(tr.stdOutContained(`Test Plan Configuration Id:`),
                `Should have looked for Test Plan Configuration Id`);

            assert(tr.stdOutContained(`Test Suite Ids:`),
                `Should have looked for Test Suite Ids`);

            done();
        }).catch((err) => {
            console.error('Test run failed:', err);
            throw err;
        });
    });

    it('should return error when testLanguageInput is missing', async function () {
        tl.getInput = () => null;
        const testPlanInfo = { listOfFQNOfTestCases: [] } as TestPlanData;
        const result = await newAutomatedTestsFlow(testPlanInfo, 'someSelector', {});
        assert.strictEqual(result.returnCode, 1);
        assert.strictEqual(result.errorMessage, 'Test language input is required');
    });

    it('should return error when no tests are found in test plan', async function () {
        const testPlanInfo = { listOfFQNOfTestCases: [] } as TestPlanData;
        testPlanInfo.listOfFQNOfTestCases = [];
        const result = await newAutomatedTestsFlow(testPlanInfo, 'automatedTests', {});
        assert.strictEqual(result.returnCode, 1);
    });

    it('should return error if no executor is found for the test language', async function () {
        tl.getInput = () => 'unknown-language';
        const testPlanInfo = { listOfFQNOfTestCases: [] } as TestPlanData;
        testPlanInfo.listOfFQNOfTestCases = ['test1', 'test2'];
        const result = await newAutomatedTestsFlow(testPlanInfo, 'someSelector', {});
        assert.strictEqual(result.returnCode, 1);
        assert.strictEqual(result.errorMessage, 'Test executor not found for test language: unknown-language');
    });

    it('should handle no automated tests found', async function () {
        const testPlanInfo = { listOfFQNOfTestCases: [] } as TestPlanData;
        const result = await newAutomatedTestsFlow(testPlanInfo, 'automatedTests', {});
        assert.strictEqual(result.returnCode, 1);
        assert.strictEqual(result.errorMessage, 'ErrorFailTaskOnNoAutomatedTestsFound');
    });
    
});
