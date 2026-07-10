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

        listOfTestsToBeExecuted.forEach(test => {
            listOfTestsToBeRan.push(utils.separatePlaywrightTestName ? utils.separatePlaywrightTestName(test) : test);
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

        let grepArg = '';
        try {
            const junitOutput = 'test-results/test-results.xml';
            tl.setVariable('PLAYWRIGHT_JUNIT_OUTPUT_NAME', junitOutput);
            const resultsDir = path.join(process.cwd(), 'test-results');
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir);
            }

            // Playwright test name selection usually uses 'grep'
            const grepPattern = testsToBeExecuted.map(t => utils.escapeRegex(t)).join('|');
            grepArg = grepPattern;

            tl.debug(`Grep Argument: ${grepArg}`);

            executionTimer.start();

            const commandPreview = `npx cross-env PLAYWRIGHT_JUNIT_OUTPUT_NAME=${junitOutput} playwright test --reporter=junit -g "${grepArg}"`;
            tl.debug(`Executing Playwright test command: ${commandPreview}`);

            // Building the command: npx cross-env PLAYWRIGHT_JUNIT_OUTPUT_NAME=... playwright test --reporter=junit -g ...
            this.toolRunnerPath = tl.which(constants.NPX_EXECUTABLE, true);
            this.toolRunner = tl.tool(this.toolRunnerPath);

            this.toolRunner.arg('cross-env');
            this.toolRunner.arg(`PLAYWRIGHT_JUNIT_OUTPUT_NAME=${junitOutput}`);
            this.toolRunner.arg('playwright');
            this.toolRunner.arg('test');
            this.toolRunner.arg('--reporter=junit');
            this.toolRunner.arg('-g');
            this.toolRunner.arg(grepArg);

            operationResult.returnCode = await this.toolRunner.execAsync();

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
        ciData['grepArgument'] = grepArg;
        ciData['executionStatus'] = operationResult.returnCode === 0 ? 'Success' : 'Failure';

        return operationResult;
    }
}

