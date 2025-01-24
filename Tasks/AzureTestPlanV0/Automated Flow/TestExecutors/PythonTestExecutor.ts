import { ITestExecutor } from "../../Interface/ITestExecutor";
import { IOperationResult } from "../../Interface/IOperationResult";
import { ciDictionary } from "../../Common/ciEventLogger";
import * as constants from "../../Common/constants";
import { replaceLastDotWithHash, extractPythonDiscoveredTests, getExecOptions, transformPythonTestStrings } from "../../Common/utils";
import * as tl from 'azure-pipelines-task-lib/task';
import { ToolRunner } from "azure-pipelines-task-lib/toolrunner";
import { SimpleTimer } from "../../Common/SimpleTimer";

export class PythonTestExecutor implements ITestExecutor {
    testRunnerCLI: string = constants.PYTEST_EXECUTABLE;
    toolRunnerPath: string;
    toolRunner: ToolRunner;
    pomFilePath: string;

    async setup(): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };

        try {
            this.toolRunnerPath = tl.which(this.testRunnerCLI, true);
        } catch (error) {
            operationResult.returnCode = 1;
            operationResult.errorMessage = error.message || String(error);
            return operationResult;
        }

        this.toolRunner = tl.tool(this.toolRunnerPath);
        this.toolRunner.arg('--version');

        try {
            operationResult.returnCode = await this.toolRunner.execAsync();
        } catch (error) {
            operationResult.errorMessage =  error.message || String(error);
        }
        return operationResult;
    }

    async discoverTests(testsToBeExecuted: string[], ciData: ciDictionary): Promise<string[]> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };
        const args: string[] = ['--collect-only', '-q'];
        let discoveryResult = { stdout: ''};;
        this.toolRunner = tl.tool(this.toolRunnerPath);
        this.toolRunner.arg(args);

        try {
            operationResult.returnCode = await this.toolRunner.execAsync(getExecOptions(discoveryResult));
        } catch (error) {
            operationResult.errorMessage =  error.message || String(error);
        }
    
        // Extract discovered tests from stdout
        const discoveredTests: string[] = extractPythonDiscoveredTests(discoveryResult.stdout ?? '');
        var testStringtoFQNMap: Map<string, string> = new Map<string, string>();
    
        for(let test of discoveredTests){ 
            testStringtoFQNMap.set(transformPythonTestStrings(test), test);
        }
    
        var testsToRun: string[] = [];
    
        for(let test of testsToBeExecuted){
            if(!testStringtoFQNMap.has(test)){
                tl.debug(`Test ${test} not found in discovered tests`);
            }
            else{
                testsToRun.push(testStringtoFQNMap.get(test));
            }
        }
    
        // Variables for debug console logs
        const testsToBeExecutedString: string = testsToBeExecuted.join(", ");
        const testsToRunString: string = testsToRun.join(", ");
    
        tl.debug(`Tests to executed are: ${testsToBeExecutedString}`);
        tl.debug(`Tests to run are: ${testsToRunString}`);
    
        if (testsToRun.length === 0) {
            tl.warning("No common tests found between specified tests and discovered tests.");
        }
        testsToBeExecuted = testsToRun;
    
        console.log(`Found ${testsToRun.length} tests to run`);
    
        // Implement test discovery logic here
        return testsToBeExecuted;
    }

    async executeTests(testsToBeExecuted: string[], ciData: ciDictionary): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };
        let executionTimer = new SimpleTimer(constants.AUTOMATED_EXECUTION);
        executionTimer.start();

        this.toolRunner = tl.tool(this.toolRunnerPath);
        
        tl.debug("Executing python pytest tests with args :" + testsToBeExecuted);
        this.toolRunner.arg(testsToBeExecuted);
        this.toolRunner.arg('--junitxml=TEST-python-junit.xml');
        
        

        try {
            operationResult.returnCode = await this.toolRunner.execAsync();
        } catch (error) {
            operationResult.errorMessage =  error.message || String(error);
        }
        executionTimer.stop(ciData);
        
        return operationResult;
    }

    
}