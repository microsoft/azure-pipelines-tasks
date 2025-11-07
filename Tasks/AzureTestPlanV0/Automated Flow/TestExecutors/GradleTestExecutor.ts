import { ITestExecutor } from "../../Interface/ITestExecutor";
import { IOperationResult } from "../../Interface/IOperationResult";
import { ciDictionary } from "../../Common/ciEventLogger";
import * as constants from "../../Common/constants";
import { removeParenthesesFromEnd, replaceLastDotWithHash } from "../../Common/utils";
import * as tl from 'azure-pipelines-task-lib/task';
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import { SimpleTimer } from "../../Common/SimpleTimer";

export class GradleTestExecutor implements ITestExecutor {
    testRunnerCLI: string = constants.GRADLE_EXECUTABLE;
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
            this.toolRunner.arg('-v');
            operationResult.returnCode = await this.toolRunner.execAsync();
        } catch (error) {
            operationResult.returnCode = 1;
            operationResult.errorMessage = error.message || String(error);
            tl.debug("Error in Gradle setup: " + operationResult.errorMessage);
            tl.debug("Looking for Gradlew file to install Gradle");
        }
        
        if(operationResult.returnCode === 1){
            operationResult.returnCode = 0;
            operationResult.errorMessage = '';

            try {
                this.toolRunnerPath = tl.which(this.gradlewFilePath, true);
            } catch (error) {
                operationResult.returnCode = 1;
                operationResult.errorMessage = error.message || String(error);
                tl.debug("Error while looking for user input Gradlew file: " + operationResult.errorMessage);
                tl.debug("Looking for gradlew file in the repository");
            }
        }

        if(operationResult.returnCode === 1){
            operationResult.returnCode = 0;
            operationResult.errorMessage = '';

            try {
                const gradlewExecFileSearchPattern: string = "**/gradlew";
                let workingDirectory = tl.getVariable('System.DefaultWorkingDirectory');
                let os = tl.getVariable('Agent.OS');
                const gradlewPath = tl.findMatch(workingDirectory, gradlewExecFileSearchPattern);
                this.toolRunnerPath = gradlewPath[0];
            
                if (gradlewPath.length == 0) {
                    operationResult.returnCode = 1;
                    operationResult.errorMessage = tl.loc('GradlewNotFound');
                    tl.debug("Gradlew file not found in the repository");
                    return operationResult;
                }
            
                if (gradlewPath.length > 1) {
                    tl.warning(tl.loc('MultipleMatchingGradlewFound'));
                    tl.debug(this.toolRunnerPath);
                }
            
                if (os == 'Windows_NT') {
                    tl.debug('Append .bat extension name to gradlew script for windows agent');
                    this.toolRunnerPath += '.bat';
                }
            } catch (error) {
                operationResult.returnCode = 1;
                operationResult.errorMessage = error.message || String(error);
                tl.debug("Error while looking for gradlew file in the repository: " + operationResult.errorMessage);
            }

            return operationResult;
        }


        try {
            operationResult.returnCode = await this.toolRunner.execAsync();
        } catch (error) {
            operationResult.errorMessage =  error.message || String(error);
        }
        return operationResult;
    }

    async discoverTests(listOfTestsToBeExecuted: string[], ciData: ciDictionary, listOfTestsToBeRan: string[]): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };

        listOfTestsToBeExecuted.forEach(element => {
            listOfTestsToBeRan.push(element);
        });
        
        return operationResult;
    }

    async executeTests(testsToBeExecuted: string[], ciData: ciDictionary): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };
        let executionTimer = new SimpleTimer(constants.AUTOMATED_EXECUTION);
        executionTimer.start();

        this.toolRunner = tl.tool(this.toolRunnerPath);
        const args = []

        args.push('test');  
    
        for (let testcase of testsToBeExecuted) {
            // in some cases found that gradle is including () in test name
            testcase = removeParenthesesFromEnd(testcase);
            args.push('--tests');
            args.push(testcase);
        }
    
        tl.debug("Executing gradle tests with args :" + args);
        this.toolRunner.arg(args);

        try {
            operationResult.returnCode = await this.toolRunner.execAsync();
        } catch (error) {
            operationResult.errorMessage =  error.message || String(error);
        }
        executionTimer.stop(ciData);
        
        return operationResult;
    }
}