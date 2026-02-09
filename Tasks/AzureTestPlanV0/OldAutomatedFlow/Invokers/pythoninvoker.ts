import { spawn, SpawnResult } from '../../OldAutomatedFlow/testexecutor';
import tl = require('azure-pipelines-task-lib/task');
import constants = require('../../Common/constants');

export async function executePythonTests(testsToBeExecuted: string[]):Promise<number> {
    // Perform test discovery
    const discoveryArgs: string[] = ['--collect-only', '-q', '-o', 'addopts='];
    const discoveryResult = await runPytestCommand(discoveryArgs);

    if (discoveryResult.status !== 0) {
        tl.error("Error occurred during test discovery: " + (discoveryResult.error ? discoveryResult.error.message : "Unknown error"));
        return 1;
    }

    // Extract discovered tests from stdout
    const discoveredTests: string[] = extractDiscoveredTests(discoveryResult.stdout ?? '');
    var testStringtoFQNMap: Map<string, string> = new Map<string, string>();

    for(let test of discoveredTests){ 
        testStringtoFQNMap.set(transformTestStrings(test), test);
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

    // Find common tests between testsToBeExecuted and discovered tests
    //const testsToRun: string[] = testsToBeExecuted.filter(test => discoveredTests.indexOf(test) !== -1);

    // Variables for debug console logs
    const testsToBeExecutedString: string = testsToBeExecuted.join(", ");
    const testsToRunString: string = testsToRun.join(", ");

    tl.debug(`Tests to executed are: ${testsToBeExecutedString}`);
    tl.debug(`Tests to run are: ${testsToRunString}`);

    if (testsToRun.length === 0) {
        tl.warning("No common tests found between specified tests and discovered tests.");
        return 0;
    }

    console.log(`Found ${testsToRun.length} tests to run`);

    // Construct arguments for running selected tests
    const args: string[] = testsToRun.concat(['--junitxml=TEST-python-junit.xml', '-o', 'addopts=']);

    tl.debug("Executing python tests with args: " + args);

    const { status, error } = await runPytestCommand(args);

    if (error) {
        tl.error("Error executing pytest command: " + error.message);
        return 1;
    }

    return status ?? 1;
}

async function runPytestCommand(args: string[]): Promise<SpawnResult> {
    const executable = constants.PYTEST_EXECUTABLE;

    try {
        const { status, error, stdout } = await spawn(executable, args);
        console.log("pytest stdout:", stdout);

        if (status === 0) {
            return { status, stdout };
        } else {
            return { status, error };
        }
    } catch (err) {
        return { status: 1, error: err };
    }
}

function extractDiscoveredTests(output: string): string[] {
    var testNames: string[] = [];
    var lines: string[] = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if(line && line.includes(".py")){
            testNames.push(line);
        }
    }
    tl.debug("Discovered tests : " + testNames);
    return testNames;
}

// Input is like Folder/SubFolder/TestClass.py::TestSubClass::TestSubSubClass::test_method_name
// Output is lke Folder.SubFolder.TestClass.TestSubClass.TestSubSubClass.test_method_name
function transformTestStrings(automatedTestName: string): string {
        // Remove any leading or trailing whitespace
        automatedTestName = automatedTestName.trim();
        let updatedAutomatedTestName: string = automatedTestName;

        const index = automatedTestName.indexOf("::");
        if(index !== -1) {
            let testFilePath = automatedTestName.substring(0, index);
            let testMethod = automatedTestName.substring(index + 2);

            //Check if testfilePath is a python file
            if(testFilePath.endsWith(".py")) {
                testFilePath = testFilePath.slice(0, -3).replace(/\//g, '.');

                //Do the same replace with :: to . in testMethod
                testMethod = testMethod.replace(/::/g, '.');

                //Finally generate updatedAutomatedTestName
                updatedAutomatedTestName = testFilePath + "." + testMethod;
            }
        }

        return updatedAutomatedTestName;
}