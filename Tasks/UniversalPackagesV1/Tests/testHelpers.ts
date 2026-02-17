import * as path from 'path';
import * as assert from 'assert';
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import { UniversalMockHelper } from './UniversalMockHelper';
import { TEST_CONSTANTS } from './TestConstants';
import { UniversalMockTestRunner } from './UniversalMockTestRunner';

function assertResultMessage(tr: MockTestRunner, expectedMessage: string): void {
    assert(tr.stdOutContained(expectedMessage), `should contain result message: ${expectedMessage}`);
}

function assertTaskSucceeded(tr: MockTestRunner): void {
    assert(tr.succeeded, 'should have succeeded');
    assert.equal(tr.errorIssues.length, 0, "should have no errors");
}

function assertTaskFailed(tr: MockTestRunner): void {
    assert(tr.failed, 'should have failed');
    assert(tr.errorIssues.length > 0, 'should have error messages');
}

export function buildCommandString(params: {
    command: string;
    feed: string;
    projectName?: string;
    description?: string;
    serviceUrl?: string;
    packageVersion?: string;
}): string {
    const { command, feed, projectName, description, serviceUrl = TEST_CONSTANTS.SERVICE_URL, packageVersion = TEST_CONSTANTS.PACKAGE_VERSION } = params;
    let commandString = `${UniversalMockHelper.getArtifactToolPath()} universal ${command} --feed ${feed} --service ${serviceUrl} --package-name ${TEST_CONSTANTS.PACKAGE_NAME} --package-version ${packageVersion} --path ${TEST_CONSTANTS.DOWNLOAD_PATH} --patvar UNIVERSAL_AUTH_TOKEN --verbosity Information`;
    
    if (projectName) {
        commandString += ` --project ${projectName}`;
    }
    
    if (description) {
        commandString += ` --description ${description}`;
    }
    
    return commandString;
}

export async function runTestWithEnv(testRunnerFile: string, envVars: { [key: string]: string } = {}): Promise<UniversalMockTestRunner> {
    // Set environment variables
    const envKeys = Object.keys(envVars);
    for (const key of envKeys) {
        process.env[key] = envVars[key];
    }
    
    try {
        // Run the test - UniversalMockTestRunner automatically parses task.setvariable commands
        let tp = path.join(__dirname, testRunnerFile);
        let tr = new UniversalMockTestRunner(tp);
        await tr.runAsync(20); // Force Node 20 for tests (task lib doesn't support Node 24 yet)
        
        return tr;
    } finally {
        // Clean up environment variables
        for (const key of envKeys) {
            delete process.env[key];
        }
    }
}

export function assertArtifactToolCommand(params: {
    tr: MockTestRunner;
    command: string;
    shouldSucceed: boolean;
    expectedCommandString: string;
    expectedMessage: string;
}): void {
    const { tr, command, shouldSucceed, expectedCommandString, expectedMessage } = params;
    assert(tr.ran(expectedCommandString), `should have run ArtifactTool with command: ${command}`);
    
    // Verify tool was invoked exactly once
    assert(tr.invokedToolCount == 1, 'should have run ArtifactTool once');
    
    // Assert success/failure state
    if (shouldSucceed) {
        assertTaskSucceeded(tr);
    } else {
        assertTaskFailed(tr);
    }
    
    // Verify the result message from tl.setResult()
    assertResultMessage(tr, expectedMessage);
}

export function assertTaskFailedBeforeToolExecution(tr: MockTestRunner, expectedErrorMessage: string): void {
    assertTaskFailed(tr);
    assert.equal(tr.invokedToolCount, 0, 'should not have invoked any tools');
    assertResultMessage(tr, expectedErrorMessage);
}
