import fs = require('fs');
import assert = require('assert');
import path = require('path');
import ttm = require('azure-pipelines-task-lib/mock-test');
const tl = require('azure-pipelines-task-lib/task');
import { TestPlanData } from '../testPlanData';
import { newAutomatedTestsFlow } from '../Automated Flow/automatedFlow';
import * as utils from '../Common/utils';
import * as constants from '../Common/constants';
import { JestTestExecutor } from '../Automated Flow/TestExecutors/JestTestExecutor';
import { testInvoker } from '../OldAutomatedFlow/automatedTestInvoker';

describe('AzureTestPlan Suite', function () {
    this.timeout(30000);

    const originalGetInput = tl.getInput;
    const originalGetBoolInput = tl.getBoolInput;
    const originalGetPipelineFeature = tl.getPipelineFeature;
    const originalTool = tl.tool;
    const originalWhich = tl.which;
    let originalJestJunitOutputName: string;

    beforeEach(() => {
        originalJestJunitOutputName = process.env['JEST_JUNIT_OUTPUT_NAME'];
        tl.getInput = (key, required) => key === 'testLanguageInput' ? 'Python' : null;
        tl.getBoolInput = () => false;
    });

    afterEach(() => {
        tl.getInput = originalGetInput;
        tl.getBoolInput = originalGetBoolInput;
        tl.getPipelineFeature = originalGetPipelineFeature;
        tl.tool = originalTool;
        tl.which = originalWhich;
        if (originalJestJunitOutputName === undefined) {
            delete process.env['JEST_JUNIT_OUTPUT_NAME'];
        } else {
            process.env['JEST_JUNIT_OUTPUT_NAME'] = originalJestJunitOutputName;
        }
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

    it('should keep the Jest test name in one argument when structured arguments are enabled', function () {
        const testName = 'benign" --showConfig --testNamePattern="benign';
        const runner = tl.tool('npx');

        utils.setJestTestRunnerArguments(runner, testName, true);

        assert.deepStrictEqual(runner.args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            `--testNamePattern=${testName}`,
        ]);
    });

    it('should trim surrounding whitespace from structured Jest test names', function () {
        const testNames = [' adds numbers', 'adds numbers ', ' adds numbers ', '\tadds numbers\t'];

        for (const testName of testNames) {
            const runner = tl.tool('npx');

            utils.setJestTestRunnerArguments(runner, testName, true);

            assert.deepStrictEqual(runner.args, [
                'jest',
                '--ci',
                '--reporters=default',
                '--reporters=jest-junit',
                '--testNamePattern=adds numbers',
            ], JSON.stringify(testName));
        }
    });

    it('should keep option-shaped Jest test names in one argument after trimming whitespace', function () {
        const testName = 'benign" --showConfig --testNamePattern="benign';
        const runner = tl.tool('npx');

        utils.setJestTestRunnerArguments(runner, ` \t${testName}\t `, true);

        assert.deepStrictEqual(runner.args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            `--testNamePattern=${testName}`,
        ]);
    });

    it('should preserve legacy Jest command parsing when structured arguments are disabled', function () {
        const runner = tl.tool('npx');

        utils.setJestTestRunnerArguments(runner, 'adds numbers', false);

        assert.deepStrictEqual(runner.args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            '-t',
            'adds numbers',
        ]);
    });

    it('should resolve the feature flag once in the new Jest flow', async function () {
        const testName = 'benign" --showConfig --testNamePattern="benign';
        let featureFlagCalls = 0;
        const runners = [];
        tl.getPipelineFeature = (featureFlag: string) => {
            featureFlagCalls++;
            assert.strictEqual(featureFlag, constants.STRUCTURED_JEST_ARGUMENTS_FIX_FEATURE);
            return true;
        };
        tl.tool = (toolPath: string) => {
            const runner = originalTool(toolPath);
            runner.execAsync = async () => 0;
            runners.push(runner);
            return runner;
        };
        const executor = new JestTestExecutor();
        executor.toolRunnerPath = 'npx';

        const result = await executor.executeTests([testName, 'second test'], {});

        assert.strictEqual(result.returnCode, 0);
        assert.strictEqual(featureFlagCalls, 1);
        assert.strictEqual(runners.length, 2);
        assert.deepStrictEqual(runners[0].args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            `--testNamePattern=${testName}`,
        ]);
    });

    it('should resolve the feature flag once through the legacy Jest dispatcher', async function () {
        const testName = 'benign" --showConfig --testNamePattern="benign';
        let featureFlagCalls = 0;
        const runners = [];
        tl.getInput = (key: string) => key === 'testLanguageInput' ? 'Jest' : null;
        tl.getPipelineFeature = (featureFlag: string) => {
            featureFlagCalls++;
            assert.strictEqual(featureFlag, constants.STRUCTURED_JEST_ARGUMENTS_FIX_FEATURE);
            return true;
        };
        tl.which = (tool: string) => tool;
        tl.tool = (toolPath: string) => {
            const runner = originalTool(toolPath);
            runner.exec = async () => 0;
            runners.push(runner);
            return runner;
        };

        const result = await testInvoker([testName, 'second test'], {});

        assert.strictEqual(result, 0);
        assert.strictEqual(featureFlagCalls, 1);
        assert.strictEqual(runners.length, 3);
        assert.deepStrictEqual(runners[1].args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            `--testNamePattern=${testName}`,
        ]);
    });
    
});
