import { ITestExecutor } from "../../Interface/ITestExecutor";
import { IOperationResult } from "../../Interface/IOperationResult";
import { ciDictionary } from "../../Common/ciEventLogger";
import * as constants from "../../Common/constants";
import { removeParenthesesFromEnd, replaceLastDotWithHash } from "../../Common/utils";
import * as tl from 'azure-pipelines-task-lib/task';
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import { SimpleTimer } from "../../Common/SimpleTimer";
import * as utils from "../../Common/utils";

export class JestTestExecutor implements ITestExecutor {
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
            this.toolRunner.line('install jest-junit');
            operationResult.returnCode = await this.toolRunner.execAsync();
            this.toolRunnerPath = tl.which(constants.NPX_EXECUTABLE, true);
        } catch (error) {
            operationResult.returnCode = 1;
            operationResult.errorMessage = error.message || String(error);
            tl.debug("Error in setting up env for Jest Test Framework: " + operationResult.errorMessage);
        }

        return operationResult;
    }

    async discoverTests(listOfTestsToBeExecuted: string[], ciData: ciDictionary, listOfTestsToBeRan: string[]): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };

        listOfTestsToBeExecuted.forEach(element => {
            listOfTestsToBeRan.push(utils.separateJestTestName(element));
        });
        
        return operationResult;
    }

    async executeTests(testsToBeExecuted: string[], ciData: ciDictionary): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };
        let executionTimer = new SimpleTimer(constants.AUTOMATED_EXECUTION);
        let i = 0;
        executionTimer.start();

        for (let test of testsToBeExecuted) {
            this.toolRunner = tl.tool(this.toolRunnerPath);
            try {
                let reportName: string = `TEST-Jest${i}-junit.xml`;
                tl.setVariable('JEST_JUNIT_OUTPUT_NAME', reportName);
                tl.debug("Executing jest test with args :" + `jest --ci --reporters=default --reporters=jest-junit -t "${test}"`);
                this.toolRunner.line(`jest --ci --reporters=default --reporters=jest-junit -t "${test}"`);
                operationResult.returnCode = await this.toolRunner.execAsync();
            } catch (error) {
                if(operationResult.errorMessage === '') {
                    operationResult.errorMessage =  error.message || String(error);
                }
                else{
                    operationResult.errorMessage = operationResult.errorMessage + '\n' + (error.message || String(error));
                }

            }
            i++;
        }

        if(operationResult.errorMessage !== ''){
            operationResult.returnCode = 1;
        }

        executionTimer.stop(ciData);      
        return operationResult;
    }
}