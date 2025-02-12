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
    gradlewFilePath: string;

    /*
    * Setup the test executor
    */
    async setup(): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };
        this.gradlewFilePath = tl.getInput('gradleFilePath');

        try {
            this.toolRunnerPath = tl.which(this.testRunnerCLI, true);
            this.toolRunner = tl.tool(this.toolRunnerPath);
            this.toolRunner.arg("i jest-junit");
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
            if(operationResult.returnCode !== 0) {
                break;
            }
            
            const args = [];
            this.toolRunner = tl.tool(this.toolRunnerPath);
            try {
                let reportName: string = `TEST-Jest${i}-junit.xml`;
                tl.setVariable('JEST_JUNIT_OUTPUT_NAME', reportName);
                args.push(`jest --ci --reporters=default --reporters=jest-junit -t "${test}"`);
                tl.debug("Executing jest test with args :" + args);
                this.toolRunner.arg(args);
                operationResult.returnCode = await this.toolRunner.execAsync();
            } catch (error) {
                operationResult.errorMessage =  error.message || String(error);
            }
            i++;
        }

        executionTimer.stop(ciData);      
        return operationResult;
    }
}