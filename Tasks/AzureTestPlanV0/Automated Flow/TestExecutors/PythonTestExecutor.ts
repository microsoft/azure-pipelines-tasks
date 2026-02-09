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

    async discoverTests(testsToBeExecuted: string[], ciData: ciDictionary, listOfTestsToBeRan: string[]): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };
        // Use -o addopts= to override pytest.ini's addopts (e.g., -v) to ensure consistent output format
        // Without this, verbose mode changes output from "test.py::name" to tree format "<Function name>"
        const args: string[] = ['--collect-only', '-q', '-o', 'addopts='];
        let discoveryResult = { stdout: ''};
        this.toolRunner = tl.tool(this.toolRunnerPath);
        this.toolRunner.arg(args);

        try {
            operationResult.returnCode = await this.toolRunner.execAsync(getExecOptions(discoveryResult));
        } catch (error) {
            operationResult.errorMessage =  error.message || String(error);
        }

        if(operationResult.returnCode === 0){
            // Extract discovered tests from stdout
            const discoveredTests: string[] = extractPythonDiscoveredTests(discoveryResult.stdout ?? '');
            var testStringtoFQNMap: Map<string, string> = new Map<string, string>();
        
            for(let test of discoveredTests){ 
                testStringtoFQNMap.set(transformPythonTestStrings(test), test);
            }
        
            for(let test of testsToBeExecuted){
                if(!testStringtoFQNMap.has(test)){
                    tl.debug(`Test ${test} not found in discovered tests`);
                }
                else{
                    listOfTestsToBeRan.push(testStringtoFQNMap.get(test));
                }
            }
        
            // Variables for debug console logs
            const testsToBeExecutedString: string = testsToBeExecuted.join(", ");
            const testsToRunString: string = listOfTestsToBeRan.join(", ");
        
            tl.debug(`Tests to executed are: ${testsToBeExecutedString}`);
            tl.debug(`Tests to run are: ${testsToRunString}`);
            console.log(`Found ${listOfTestsToBeRan.length} tests to run`);

            return operationResult;
        }
    }

    async executeTests(testsToBeExecuted: string[], ciData: ciDictionary): Promise<IOperationResult> {
        let operationResult: IOperationResult = { returnCode: 0, errorMessage: '' };
        let executionTimer = new SimpleTimer(constants.AUTOMATED_EXECUTION);
        executionTimer.start();

        this.toolRunner = tl.tool(this.toolRunnerPath);
        
        tl.debug("Executing python pytest tests with args :" + testsToBeExecuted);
        this.toolRunner.arg(testsToBeExecuted);
        this.toolRunner.arg('--junitxml=TEST-python-junit.xml');
        // Use -o addopts= to override pytest.ini's addopts (e.g., -v) for consistent behavior
        this.toolRunner.arg(['-o', 'addopts=']);
        
        try {
            operationResult.returnCode = await this.toolRunner.execAsync();
        } catch (error) {
            operationResult.errorMessage =  error.message || String(error);
        }
        executionTimer.stop(ciData);
        
        return operationResult;
    }

    
}