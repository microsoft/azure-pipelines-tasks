import { ITestExecutor } from "../../Interface/ITestExecutor";
import { IOperationResult } from "../../Interface/IOperationResult";
import { ciDictionary } from "../../Common/ciEventLogger";
import * as constants from "../../Common/constants";
import { replaceLastDotWithHash } from "../../Common/utils";
import * as tl from 'azure-pipelines-task-lib/task';
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import { SimpleTimer } from "../../Common/SimpleTimer";

export class MavenTestExecutor implements ITestExecutor {
    testRunnerCLI: string = constants.MVN_EXECUTABLE;
    toolRunnerPath: string;
    toolRunner: ToolRunner;
    pomFilePath: string;

    async setup(): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };
        this.pomFilePath = tl.getInput('pomFilePath');

        try {
            this.toolRunnerPath = tl.which(this.testRunnerCLI, true);
        } catch (error) {
            operationResult.returnCode = 1;
            operationResult.errorMessage = error.message || String(error);
            return operationResult;
        }


        this.toolRunner = tl.tool(this.toolRunnerPath);
        this.toolRunner.arg('-version');

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
        const testsToRun =[]

        for (let tests of testsToBeExecuted) {
            const modifiedTest = replaceLastDotWithHash(tests);
            testsToRun.push(modifiedTest);
        }
    
        if (testsToRun.length > 0)
        {
            const testsList = testsToRun.join(',')
            const dtest = constants.MAVEN_DTEST;
            const combinedTestArgs = dtest + testsList;
    
            args.push('test');
            args.push(combinedTestArgs);
        }

        args.push('-ntp');
    
        if (this.pomFilePath) {
            args.push('-f');
            args.push(this.pomFilePath);
        }
        
        tl.debug("Executing java maven tests with args :" + args);
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