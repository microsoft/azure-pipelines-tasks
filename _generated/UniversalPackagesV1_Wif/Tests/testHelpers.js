"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertResultMessage = assertResultMessage;
exports.buildCommandString = buildCommandString;
exports.runTestWithEnv = runTestWithEnv;
exports.assertArtifactToolCommand = assertArtifactToolCommand;
exports.assertTaskFailedBeforeToolExecution = assertTaskFailedBeforeToolExecution;
const path = require("path");
const assert = require("assert");
const UniversalMockHelper_1 = require("./UniversalMockHelper");
const testConstants_1 = require("./testConstants");
const UniversalMockTestRunner_1 = require("./UniversalMockTestRunner");
function assertTaskSucceeded(tr) {
    assert(tr.succeeded, 'should have succeeded');
    assert.equal(tr.errorIssues.length, 0, "should have no errors");
}
function assertTaskFailed(tr) {
    assert(tr.failed, 'should have failed');
    assert(tr.errorIssues.length > 0, 'should have error messages');
}
function assertResultMessage(tr, expectedMessage) {
    assert(tr.stdOutContained(expectedMessage), `should contain result message: ${expectedMessage}`);
}
function buildCommandString(params) {
    const { command, feed, projectName, description, serviceUrl = testConstants_1.TEST_CONSTANTS.SERVICE_URL, packageVersion = testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION } = params;
    let commandString = `${UniversalMockHelper_1.UniversalMockHelper.getArtifactToolPath()} universal ${command} --feed ${feed} --service ${serviceUrl} --package-name ${testConstants_1.TEST_CONSTANTS.PACKAGE_NAME} --package-version ${packageVersion} --path ${testConstants_1.TEST_CONSTANTS.DOWNLOAD_PATH} --patvar UNIVERSAL_AUTH_TOKEN --verbosity Information`;
    if (projectName) {
        commandString += ` --project ${projectName}`;
    }
    if (description) {
        commandString += ` --description ${description}`;
    }
    return commandString;
}
function runTestWithEnv(testRunnerFile_1) {
    return __awaiter(this, arguments, void 0, function* (testRunnerFile, envVars = {}) {
        // Set environment variables
        const envKeys = Object.keys(envVars);
        for (const key of envKeys) {
            process.env[key] = envVars[key];
        }
        try {
            // Run the test - UniversalMockTestRunner automatically parses task.setvariable commands
            let tp = path.join(__dirname, testRunnerFile);
            let tr = new UniversalMockTestRunner_1.UniversalMockTestRunner(tp);
            yield tr.runAsync(20); // Force Node 20 for tests (task lib doesn't support Node 24 yet)
            return tr;
        }
        finally {
            // Clean up environment variables
            for (const key of envKeys) {
                delete process.env[key];
            }
        }
    });
}
function assertArtifactToolCommand(params) {
    const { tr, command, shouldSucceed, expectedCommandString, expectedMessage } = params;
    assert(tr.ran(expectedCommandString), `should have run ArtifactTool with command: ${command}`);
    // Verify tool was invoked exactly once
    assert(tr.invokedToolCount == 1, 'should have run ArtifactTool once');
    // Assert success/failure state
    if (shouldSucceed) {
        assertTaskSucceeded(tr);
    }
    else {
        assertTaskFailed(tr);
    }
    // Verify the result message from tl.setResult()
    assertResultMessage(tr, expectedMessage);
}
function assertTaskFailedBeforeToolExecution(tr, expectedErrorMessage) {
    assertTaskFailed(tr);
    assert.equal(tr.invokedToolCount, 0, 'should not have invoked any tools');
    assertResultMessage(tr, expectedErrorMessage);
}
