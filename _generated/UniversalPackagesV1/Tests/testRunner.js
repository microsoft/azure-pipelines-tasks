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
const mock_run_1 = require("azure-pipelines-task-lib/mock-run");
const path = require("path");
const UniversalMockHelper_1 = require("./UniversalMockHelper");
const testConstants_1 = require("./testConstants");
const testHelpers = require("./testHelpers");
// Mock global fetch before anything else runs
// This prevents real network calls in L0 tests
const FEED_RESOURCE_AREA_ID = '7ab4e64e-c4d8-4f50-ae73-5ef2e21642a5';
const mockFetch = (url, options) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    const method = ((_a = options === null || options === void 0 ? void 0 : options.method) === null || _a === void 0 ? void 0 : _a.toUpperCase()) || 'GET';
    // Anonymous GET to resource areas API → returns feed service locationUrl
    if (method === 'GET' && url.includes('/_apis/resourceAreas/')) {
        const feedServiceUrl = process.env['MOCK_FEED_SERVICE_URL'] || (url.includes('other-org')
            ? testConstants_1.TEST_CONSTANTS.CROSS_ORG_FEED_SERVICE_URL
            : testConstants_1.TEST_CONSTANTS.FEED_SERVICE_URL);
        return {
            ok: true,
            status: 200,
            headers: { get: () => null },
            json: () => __awaiter(void 0, void 0, void 0, function* () {
                return ({
                    id: FEED_RESOURCE_AREA_ID,
                    name: 'Feeds',
                    locationUrl: feedServiceUrl
                });
            })
        };
    }
    // HEAD to feed service URI → returns X-VSS-ResourceTenant for WIF tenant discovery
    if (method === 'HEAD') {
        return {
            ok: true,
            status: 200,
            headers: {
                get: (name) => {
                    if (name.toLowerCase() === 'x-vss-resourcetenant') {
                        return testConstants_1.TEST_CONSTANTS.MOCK_TENANT_ID;
                    }
                    return null;
                }
            }
        };
    }
    // Fallback for unexpected calls
    return { ok: false, status: 404, headers: { get: () => null } };
});
global.fetch = mockFetch;
const isPreJob = process.env['MOCK_PRE_JOB'] === 'true';
let taskPath = isPreJob
    ? path.join(__dirname, '..', 'preJobExecution.js')
    : path.join(__dirname, '..', 'universalMain.js');
let tmr = new mock_run_1.TaskMockRunner(taskPath);
// All configuration from environment variables
const config = {
    inputs: {
        command: process.env['INPUT_COMMAND'] || 'download',
        directory: testConstants_1.TEST_CONSTANTS.DOWNLOAD_PATH,
        feedUrl: process.env['INPUT_FEEDURL'],
        feed: process.env['INPUT_FEED'] || testConstants_1.TEST_CONSTANTS.FEED_NAME,
        packageName: testConstants_1.TEST_CONSTANTS.PACKAGE_NAME,
        packageVersion: process.env['INPUT_PACKAGEVERSION'],
        versionIncrement: process.env['INPUT_VERSIONINCREMENT'],
        packageDescription: process.env['INPUT_PACKAGE_DESCRIPTION'],
        adoServiceConnection: process.env['INPUT_ADOSERVICECONNECTION']
    },
    wifAuthBehavior: process.env['WIF_AUTH_BEHAVIOR'],
    systemTokenAvailable: process.env['SYSTEM_TOKEN_AVAILABLE'] !== 'false',
    providesSessionId: process.env['PROVENANCE_PROVIDES_SESSION_ID'],
    serviceUrl: process.env['MOCK_SERVICE_URL'] || testConstants_1.TEST_CONSTANTS.SERVICE_URL,
    highestPackageVersion: process.env['MOCK_HIGHEST_PACKAGE_VERSION'],
    expectedIncrementedVersion: process.env['MOCK_EXPECTED_VERSION']
};
// Override ENDPOINT_URL_SYSTEMVSSCONNECTION if test specified a different service URL
if (process.env['MOCK_SERVICE_URL']) {
    process.env['ENDPOINT_URL_SYSTEMVSSCONNECTION'] = config.serviceUrl;
}
// Build exec result
const exitCode = parseInt(process.env['MOCK_EXIT_CODE'] || '0');
config.execResult = {
    code: exitCode,
    stdout: exitCode === 0 ? testConstants_1.TEST_CONSTANTS.SUCCESS_OUTPUT : '',
    stderr: process.env['MOCK_STDERR'] || ''
};
// Extract project ID from feed if it's project-scoped (format: "ProjectName/FeedName")
const feedParts = config.inputs.feed.split('/');
config.projectId = feedParts.length > 1 ? feedParts[0] : undefined;
config.feedName = feedParts.length > 1 ? feedParts[1] : config.inputs.feed;
// Determine effective feed (provenance session ID if publish + provenance + service connection, otherwise feedName)
const providesSessionId = config.providesSessionId;
const effectiveFeed = (config.inputs.command === 'publish' && providesSessionId === 'true' && config.inputs.adoServiceConnection)
    ? testConstants_1.TEST_CONSTANTS.PROVENANCE_SESSION_ID
    : config.feedName;
// Determine expected package version
// Use explicit expected version if provided, otherwise use packageVersion input or default
const expectedPackageVersion = process.env['MOCK_EXPECTED_VERSION']
    || config.inputs.packageVersion
    || testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION;
// Build command string
config.commandString = testHelpers.buildCommandString({
    command: config.inputs.command,
    feed: effectiveFeed,
    projectName: config.projectId,
    description: config.inputs.packageDescription,
    serviceUrl: config.inputs.adoServiceConnection && config.inputs.feedUrl
        ? config.inputs.feedUrl
        : config.serviceUrl,
    packageVersion: expectedPackageVersion
});
// Set task inputs
for (const [key, value] of Object.entries(config.inputs)) {
    if (value !== undefined) {
        tmr.setInput(key, String(value));
    }
}
// Create UniversalMockHelper with all configuration (constructor registers mocks as side effects)
new UniversalMockHelper_1.UniversalMockHelper(tmr, config);
// --- Pre-job mock overrides ---
if (process.env['MOCK_SHOULD_FAIL_INSTALL'] === 'true') {
    tmr.registerMock('azure-pipelines-tasks-packaging-common/universal/ArtifactToolUtilities', {
        getArtifactToolFromService: function () {
            throw new Error('Failed to download artifact tool');
        },
        getPackageNameFromId: function () {
            return '';
        }
    });
}
if (process.env['MOCK_SHOULD_FAIL_BLOB_URI'] === 'true') {
    tmr.registerMock('azure-pipelines-tasks-packaging-common/universal/ClientToolUtilities', {
        getBlobstoreUriFromBaseServiceUri: function () {
            throw new Error('Failed to resolve blob store URI');
        }
    });
}
tmr.run();
