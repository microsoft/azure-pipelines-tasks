import { TaskMockRunner } from 'azure-pipelines-task-lib/mock-run';
import * as path from 'path';

import { UniversalMockHelper, MockConfig } from './UniversalMockHelper';
import { TEST_CONSTANTS } from './TestConstants';
import * as TestHelpers from './TestHelpers';

let taskPath = path.join(__dirname, '..', 'universalmain.js');
let tmr: TaskMockRunner = new TaskMockRunner(taskPath);

// All configuration from environment variables
const config: MockConfig = {
    inputs: {
        command: process.env['INPUT_COMMAND'] || 'download',
        directory: TEST_CONSTANTS.DOWNLOAD_PATH,
        organization: process.env['INPUT_ORGANIZATION'],
        feed: process.env['INPUT_FEED'] || TEST_CONSTANTS.FEED_NAME,
        packageName: TEST_CONSTANTS.PACKAGE_NAME,
        packageVersion: TEST_CONSTANTS.PACKAGE_VERSION,
        verbosity: process.env['INPUT_VERBOSITY'] || 'verbose',
        packageDescription: process.env['INPUT_PACKAGE_DESCRIPTION'],
        adoServiceConnection: process.env['INPUT_ADOSERVICECONNECTION']
    },
    wifAuthBehavior: process.env['WIF_AUTH_BEHAVIOR'],
    systemTokenAvailable: process.env['SYSTEM_TOKEN_AVAILABLE'] !== 'false',
    providesSessionId: process.env['PROVENANCE_PROVIDES_SESSION_ID'],
    serviceUrl: process.env['MOCK_SERVICE_URL'] || TEST_CONSTANTS.SERVICE_URL
} as MockConfig;

// Override ENDPOINT_URL_SYSTEMVSSCONNECTION if test specified a different service URL
if (process.env['MOCK_SERVICE_URL']) {
    process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = config.serviceUrl;
}

// Build exec result
const exitCode = parseInt(process.env['MOCK_EXIT_CODE'] || '0');
config.execResult = {
    code: exitCode,
    stdout: exitCode === 0 ? TEST_CONSTANTS.SUCCESS_OUTPUT : '',
    stderr: process.env['MOCK_STDERR'] || ''
};

// Extract project ID from feed if it's project-scoped (format: "ProjectName/FeedName")
const feedParts = config.inputs.feed.split('/');
config.projectId = feedParts.length > 1 ? feedParts[0] : undefined;
config.feedName = feedParts.length > 1 ? feedParts[1] : config.inputs.feed;

// Determine effective feed (provenance session ID if publish + provenance + service connection, otherwise feedName)
const providesSessionId = config.providesSessionId;
const effectiveFeed = (config.inputs.command === 'publish' && providesSessionId === 'true' && config.inputs.adoServiceConnection)
    ? TEST_CONSTANTS.PROVENANCE_SESSION_ID
    : config.feedName;

// Build command string
config.commandString = TestHelpers.buildCommandString({
    command: config.inputs.command,
    feed: effectiveFeed,
    projectName: config.projectId,
    description: config.inputs.packageDescription,
    serviceUrl: config.serviceUrl
});

// Set task inputs
for (const [key, value] of Object.entries(config.inputs)) {
    if (value !== undefined) {
        tmr.setInput(key, String(value));
    }
}

// Create UniversalMockHelper with all configuration
const mockHelper = new UniversalMockHelper(tmr, config);

tmr.run();

// Output the captured token using standard Azure Pipelines convention
// This allows tests to verify which token (WIF or system) was actually used
if (mockHelper.usedToken) {
    console.log(`##vso[task.setvariable variable=CAPTURED_AUTH_TOKEN;isOutput=false;issecret=false;]${mockHelper.usedToken}`);
}
