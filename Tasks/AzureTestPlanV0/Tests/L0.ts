import fs = require('fs');
import assert = require('assert');
import path = require('path');
import ttm = require('azure-pipelines-task-lib/mock-test');
const tl = require('azure-pipelines-task-lib/task');
import { TestPlanData } from '../testPlanData';
import { newAutomatedTestsFlow } from '../Automated Flow/automatedFlow';
import { batchPlaywrightTestLocations } from '../Common/utils';

describe('AzureTestPlan Suite', function () {
    this.timeout(30000);

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

    it('Batches resolved Playwright test locations without splitting a spec file', () => {
        const locations: string[] = [];
        for (let file = 0; file < 40; file++) {
            for (const line of [10, 40, 75, 120, 160, 200, 240]) {
                locations.push(`tests/playwright/src/specs/generated-scenario-${file}.spec.ts:${line}`);
            }
        }

        const batches = batchPlaywrightTestLocations(locations);

        assert(batches.length > 1,
            `A plan larger than one command line should be split, got ${batches.length} invocation(s)`);
        assert.deepStrictEqual(batches.reduce((all, batch) => all.concat(batch), []), locations,
            'Every location should run exactly once, in resolution order');

        for (const batch of batches) {
            const commandLength = batch.reduce((total, location) => total + location.length + 1, 0);
            assert(commandLength <= 7000,
                `A batch should stay within the command line budget, got ${commandLength} characters`);
        }

        const batchIndexByFile = new Map<string, number>();
        batches.forEach((batch, index) => {
            for (const location of batch) {
                const file = location.substring(0, location.lastIndexOf(':'));
                const seenAt = batchIndexByFile.get(file);
                assert(seenAt === undefined || seenAt === index,
                    `Spec file ${file} was split across invocations`);
                batchIndexByFile.set(file, index);
            }
        });

        assert.strictEqual(batchPlaywrightTestLocations(locations.slice(0, 7)).length, 1,
            'A plan that fits on one command line should stay a single invocation');
        assert.deepStrictEqual(batchPlaywrightTestLocations([]), [],
            'No locations should produce no invocations');
    });

    it('Check if runs fine', (done: Mocha.Done) => {
        this.timeout(3000);

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
