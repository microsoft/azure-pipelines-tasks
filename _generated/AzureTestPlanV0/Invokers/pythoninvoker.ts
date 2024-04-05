import { spawn, SpawnResult } from '../testexecutor';
import tl = require('azure-pipelines-task-lib/task');
import constants = require('../constants');

export async function executepythontests(testsToBeExecuted: string[]) {
    // Perform test discovery
    const discoveryArgs: string[] = ['--collect-only'];
    const discoveryResult = await runPytestCommand(discoveryArgs);

    if (discoveryResult.status !== 0) {
        tl.error("Error occurred during test discovery: " + (discoveryResult.error ? discoveryResult.error.message : "Unknown error"));
        return { exitCode: 1 };
    }

    // Extract discovered tests from stdout
    const discoveredTests: string[] = extractDiscoveredTests(discoveryResult.stdout ?? '');

    // Find common tests between testsToBeExecuted and discovered tests
    const testsToRun: string[] = testsToBeExecuted.filter(test => discoveredTests.indexOf(test) !== -1);

    if (testsToRun.length === 0) {
        tl.warning("No common tests found between specified tests and discovered tests.");
        return { exitCode: 0 };
    }

    console.log(`Found ${testsToRun.length} tests to run`);

    // Construct arguments for running selected tests
    const args: string[] = testsToRun.concat(['--junitxml=TEST-python-junit.xml']);

    tl.debug("Executing python tests with args: " + args);

    const { status, error } = await runPytestCommand(args);

    if (error) {
        tl.error("Error executing pytest command: " + error.message);
        return { exitCode: 1 };
    }

    return { exitCode: status ?? 1 };
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

function extractDiscoveredTests(output) {
    const testNames = [];
    let currentPackage = '';
    let currentModule = '';
    let currentClass = '';

    const lines = output.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        if (line.startsWith('<Package')) {
            currentPackage = line.match(/<Package (.*?)>/)[1];
        } else if (line.startsWith('<Module')) {
            currentModule = line.match(/<Module (.*?)>/)[1];
        } else if (line.startsWith('<UnitTestCase')) {
            currentClass = line.match(/<UnitTestCase (.*?)>/)[1];
        } else if (line.startsWith('<TestCaseFunction')) {
            const functionName = line.match(/<TestCaseFunction (.*?)>/)[1];
            let fullyQualifiedName = '';
            if (currentPackage !== '') {
                fullyQualifiedName += currentPackage + '/';
            }
            fullyQualifiedName += `${currentModule}::${currentClass}::${functionName}`;
            testNames.push(fullyQualifiedName);
        }
    }
    tl.debug("Discovered tests : " + testNames);
    return testNames;
}
