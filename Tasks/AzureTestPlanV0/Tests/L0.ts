import fs = require('fs');
import assert = require('assert');
import path = require('path');
import ttm = require('azure-pipelines-task-lib/mock-test');
const tl = require('azure-pipelines-task-lib/task');
import { TestPlanData } from '../testPlanData';
import { newAutomatedTestsFlow } from '../Automated Flow/automatedFlow';
import * as utils from '../Common/utils';
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

    it('should keep a quote-injected Jest test name in one argument', function () {
        const testName = 'benign" --showConfig --testNamePattern="benign';
        const runner = tl.tool('npx');

        utils.setJestTestRunnerArguments(runner, testName);

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

            utils.setJestTestRunnerArguments(runner, testName);

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

        utils.setJestTestRunnerArguments(runner, ` \t${testName}\t `);

        assert.deepStrictEqual(runner.args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            `--testNamePattern=${testName}`,
        ]);
    });

    it('should pass a plain Jest test name as a single testNamePattern argument', function () {
        const runner = tl.tool('npx');

        utils.setJestTestRunnerArguments(runner, 'adds numbers');

        assert.deepStrictEqual(runner.args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            '--testNamePattern=adds numbers',
        ]);
    });

    it('should keep module-loading Jest options inside the test name argument', function () {
        const testName = 'x" --globalSetup=./evil.js --setupFiles ./evil.js -t "x';
        const runner = tl.tool('npx');

        utils.setJestTestRunnerArguments(runner, testName);

        assert.strictEqual(runner.args.length, 5);
        assert.strictEqual(runner.args[4], `--testNamePattern=${testName}`);
        assert(!runner.args.some(arg => arg.startsWith('--globalSetup') || arg.startsWith('--setupFiles') || arg === '-t'));
    });

    it('should always use structured Jest arguments in the new Jest flow', async function () {
        const testName = 'benign" --showConfig --testNamePattern="benign';
        const runners = [];
        tl.getPipelineFeature = () => false;
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
        assert.strictEqual(runners.length, 2);
        assert.deepStrictEqual(runners[0].args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            `--testNamePattern=${testName}`,
        ]);
        assert.deepStrictEqual(runners[1].args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            '--testNamePattern=second test',
        ]);
    });

    it('should always use structured Jest arguments through the legacy Jest dispatcher', async function () {
        const testName = 'benign" --showConfig --testNamePattern="benign';
        const runners = [];
        tl.getInput = (key: string) => key === 'testLanguageInput' ? 'Jest' : null;
        tl.getPipelineFeature = () => false;
        tl.which = (tool: string) => tool;
        tl.tool = (toolPath: string) => {
            const runner = originalTool(toolPath);
            runner.exec = async () => 0;
            runners.push(runner);
            return runner;
        };

        const result = await testInvoker([testName, 'second test'], {});

        assert.strictEqual(result, 0);
        assert.strictEqual(runners.length, 3);
        assert.deepStrictEqual(runners[1].args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            `--testNamePattern=${testName}`,
        ]);
        assert.deepStrictEqual(runners[2].args, [
            'jest',
            '--ci',
            '--reporters=default',
            '--reporters=jest-junit',
            '--testNamePattern=second test',
        ]);
    });
    
    it('should neutralize logging commands in selector diagnostic output', async function () {
        const selector = 'manualTests\n##vso[task.setvariable variable=marker;]value';
        const previousSelector = process.env['__testSelector__'];
        process.env['__testSelector__'] = selector;

        try {
            const tp: string = path.join(__dirname, 'L0SampleTest.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            await tr.runAsync();

            assert(tr.stdOutContained('Test Selector selected: manualTests'), 'Should log the test selector prefix');
            assert(tr.stdOutContained('##_vso[task.setvariable variable=marker;]value'), 'Should neutralize logging command marker in selector diagnostic output');
            assert(!tr.stdOutContained('\n##vso[task.setvariable variable=marker;]value'), 'Should not emit raw logging command in selector diagnostic output');
        } finally {
            if (previousSelector === undefined) {
                delete process.env['__testSelector__'];
            } else {
                process.env['__testSelector__'] = previousSelector;
            }
        }
    });
    
});
