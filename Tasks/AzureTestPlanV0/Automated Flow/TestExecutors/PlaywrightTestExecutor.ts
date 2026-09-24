import { ITestExecutor } from "../../Interface/ITestExecutor";
import { IOperationResult } from "../../Interface/IOperationResult";
import { ciDictionary } from "../../Common/ciEventLogger";
import * as constants from "../../Common/constants";
import * as tl from 'azure-pipelines-task-lib/task';
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import { SimpleTimer } from "../../Common/SimpleTimer";
import * as utils from "../../Common/utils";
import * as fs from 'fs';
import * as path from 'path';

export class PlaywrightTestExecutor implements ITestExecutor {
    testRunnerCLI: string = constants.NPM_EXECUTABLE;
    toolRunnerPath: string;
    toolRunner: ToolRunner;

    /*
    * Setup the test executor
    */
    async setup(): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };

        try {
            
            this.toolRunnerPath = tl.which(this.testRunnerCLI, true);
            this.toolRunner = tl.tool(this.toolRunnerPath);
            this.toolRunner.line('install');
            operationResult.returnCode = await this.toolRunner.execAsync();
            if (operationResult.returnCode !== 0) {
                throw new Error('npm install failed');
            }

            this.toolRunnerPath = tl.which(constants.NPX_EXECUTABLE, true);
            this.toolRunner = tl.tool(this.toolRunnerPath);
            this.toolRunner.line('playwright install');
            operationResult.returnCode = await this.toolRunner.execAsync();
            if (operationResult.returnCode !== 0) {
                throw new Error('playwright install failed');
            }

            const crossEnvPath = tl.which('cross-env', false);
            if (!crossEnvPath) {
                this.toolRunnerPath = tl.which(this.testRunnerCLI, true);
                this.toolRunner = tl.tool(this.toolRunnerPath);
                this.toolRunner.line('install cross-env');
                operationResult.returnCode = await this.toolRunner.execAsync();
                if (operationResult.returnCode !== 0) {
                    throw new Error('cross-env install failed');
                }
            }

            const connectedService = tl.getInput('ConnectedServiceName', false);
            if (connectedService) {
                var authScheme: string = tl.getEndpointAuthorizationScheme(connectedService, false);
                if (authScheme && authScheme.toLowerCase() == "workloadidentityfederation") {
                    process.env.AZURESUBSCRIPTION_SERVICE_CONNECTION_ID = connectedService;
                    process.env.AZURESUBSCRIPTION_CLIENT_ID = tl.getEndpointAuthorizationParameter(connectedService, "serviceprincipalid", false);
                    process.env.AZURESUBSCRIPTION_TENANT_ID = tl.getEndpointAuthorizationParameter(connectedService, "tenantid", false); 
                    tl.debug('Environment variables AZURESUBSCRIPTION_SERVICE_CONNECTION_ID, AZURESUBSCRIPTION_CLIENT_ID and AZURESUBSCRIPTION_TENANT_ID are set');
                }
                else {
                    tl.debug('Connected service is not of type Workload Identity Federation');
                }
            }
            else {
                tl.debug('No connected service set');
            }

        } catch (error) {
            operationResult.returnCode = 1;
            operationResult.errorMessage = error.message || String(error);
            tl.debug("Error in setting up env for Playwright Test Framework: " + operationResult.errorMessage);
        }

        return operationResult;
    }

    async discoverTests(listOfTestsToBeExecuted: string[], ciData: ciDictionary, listOfTestsToBeRan: string[]): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };

        // Names are resolved to exact test locations in executeTests.
        listOfTestsToBeExecuted.forEach(test => {
            listOfTestsToBeRan.push(test);
        });

        return operationResult;
    }

    async executeTests(testsToBeExecuted: string[], ciData: ciDictionary): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };
        let executionTimer = new SimpleTimer(constants.AUTOMATED_EXECUTION);

        tl.debug(`Tests to be executed: ${JSON.stringify(testsToBeExecuted)}`);

        if (!testsToBeExecuted || testsToBeExecuted.length === 0) {
            tl.debug('No tests to execute');
            return {
                returnCode: 0,
                errorMessage: 'No tests to execute.'
            };
        }

        let resolvedLocations: string[] = [];
        let batchCount = 1;
        executionTimer.start();
        try {
            const junitOutput = 'test-results/test-results.xml';
            tl.setVariable('PLAYWRIGHT_JUNIT_OUTPUT_NAME', junitOutput);
            const resultsDir = path.join(process.cwd(), 'test-results');
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir);
            }

            // 1. List all tests as JSON; written to a file since stdout may
            // contain config/global-setup output.
            const listReportFile = path.join(resultsDir, 'playwright-list-report.json');
            this.toolRunnerPath = tl.which(constants.NPX_EXECUTABLE, true);
            this.toolRunner = tl.tool(this.toolRunnerPath);
            this.toolRunner.arg('cross-env');
            this.toolRunner.arg(`PLAYWRIGHT_JSON_OUTPUT_NAME=${listReportFile}`);
            this.toolRunner.arg('playwright');
            this.toolRunner.arg('test');
            this.toolRunner.arg('--list');
            this.toolRunner.arg('--reporter=json');

            const listReturnCode = await this.toolRunner.execAsync();
            if (listReturnCode !== 0 || !fs.existsSync(listReportFile)) {
                throw new Error(`Failed to list Playwright tests (exit code ${listReturnCode})`);
            }

            const listReport = JSON.parse(fs.readFileSync(listReportFile, 'utf8'));
            const resolved = utils.resolvePlaywrightTestLocations(listReport, testsToBeExecuted);
            resolvedLocations = resolved.locations;

            for (const name of resolved.unmatched) {
                tl.warning(`No Playwright test matched the automated test name: ${name}`);
            }
            tl.debug(`Resolved ${resolvedLocations.length} test location(s): ${JSON.stringify(resolvedLocations)}`);

            if (resolvedLocations.length === 0) {
                throw new Error('None of the selected test points matched a Playwright test');
            }
            if (resolved.unmatched.length > 0 && tl.getBoolInput('failOnUnmatchedTests', false)) {
                throw new Error(`${resolved.unmatched.length} selected test point(s) did not match any Playwright test`);
            }

            // 2. Run the resolved tests by location. A large plan can resolve
            // to more locations than one command line accepts, so the
            // locations are packed into batches that never split a spec file.
            const locationBatches = utils.batchPlaywrightTestLocations(resolvedLocations);
            batchCount = locationBatches.length;
            tl.debug(`Executing ${batchCount} Playwright invocation(s) for ${resolvedLocations.length} resolved location(s)`);

            let firstFailureCode = 0;
            for (let batchIndex = 0; batchIndex < locationBatches.length; batchIndex++) {
                // Batching must not depend on the single-invocation report
                // name (a separate change renames it), so every batch writes
                // its own report for the publisher's glob to collect.
                const batchJunitOutput = batchCount === 1
                    ? junitOutput
                    : `test-results/TEST-playwright-${batchIndex + 1}.xml`;
                const batchLocations = locationBatches[batchIndex];

                tl.debug(`Executing Playwright test command: npx cross-env PLAYWRIGHT_JUNIT_OUTPUT_NAME=${batchJunitOutput} playwright test --reporter=junit ${batchLocations.join(' ')}`);
                this.toolRunnerPath = tl.which(constants.NPX_EXECUTABLE, true);
                this.toolRunner = tl.tool(this.toolRunnerPath);

                this.toolRunner.arg('cross-env');
                this.toolRunner.arg(`PLAYWRIGHT_JUNIT_OUTPUT_NAME=${batchJunitOutput}`);
                this.toolRunner.arg('playwright');
                this.toolRunner.arg('test');
                this.toolRunner.arg('--reporter=junit');
                for (const location of batchLocations) {
                    this.toolRunner.arg(location);
                }

                const batchReturnCode = await this.toolRunner.execAsync();
                // Run every batch so the published results stay complete, and
                // report the first non-zero exit code.
                if (batchReturnCode !== 0 && firstFailureCode === 0) {
                    firstFailureCode = batchReturnCode;
                }
            }

            operationResult.returnCode = firstFailureCode;

        } catch (error) {
            tl.debug(`Error during test execution: ${error.message}`);
            operationResult.returnCode = 1;
            operationResult.errorMessage = error.message || String(error);
            ciData['failureDetails'] = {
                errorMessage: error.message || 'Unknown error',
                stackTrace: error.stack || 'No stack trace available',
                failureType: 'Execution Error'
            };
        }

        executionTimer.stop(ciData);
        ciData['resolvedTestLocations'] = resolvedLocations.join('|');
        ciData['playwrightInvocationCount'] = batchCount;
        ciData['executionStatus'] = operationResult.returnCode === 0 ? 'Success' : 'Failure';

        return operationResult;
    }
}

