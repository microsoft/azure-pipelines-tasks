import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib';
import {runTestWithEnv, assertArtifactToolCommand, assertTaskFailedBeforeToolExecution, buildCommandString } from './TestHelpers';
import { TEST_CONSTANTS, getDefaultEnvVars } from './TestConstants';

// Set resource path to enable localization in tests
tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

describe('UniversalPackages Suite', function () {
    describe('Download Operations', function () {
        this.timeout(10000);

        it('downloads package from organization-scoped feed', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('downloads package from project-scoped feed', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME, projectName: TEST_CONSTANTS.PROJECT_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_FEED': TEST_CONSTANTS.PROJECT_SCOPED_FEED_NAME,
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('handles download failure with non-zero exit code', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'MOCK_EXIT_CODE': '1',
                'MOCK_STDERR': TEST_CONSTANTS.ERROR_MESSAGE,
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: false,
                expectedCommandString,
                expectedMessage: tl.loc('Error_UnexpectedErrorArtifactToolDownload', '1', TEST_CONSTANTS.ERROR_MESSAGE)
            });
        });
    });

    describe('Publish Operations', function () {
        this.timeout(10000);

        it('publishes package to organization-scoped feed', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('publishes package to project-scoped feed', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.FEED_NAME, projectName: TEST_CONSTANTS.PROJECT_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_FEED': TEST_CONSTANTS.PROJECT_SCOPED_FEED_NAME,
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('handles publish failure with non-zero exit code', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'MOCK_EXIT_CODE': '1',
                'MOCK_STDERR': TEST_CONSTANTS.ERROR_MESSAGE,
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: false,
                expectedCommandString,
                expectedMessage: tl.loc('Error_UnexpectedErrorArtifactToolPublish', '1', TEST_CONSTANTS.ERROR_MESSAGE)
            });
        });

        it('publishes package with description', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.FEED_NAME, description: TEST_CONSTANTS.PACKAGE_DESCRIPTION });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_PACKAGE_DESCRIPTION': TEST_CONSTANTS.PACKAGE_DESCRIPTION,
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });
    });

    describe('Provenance Session Handling', function() {
        it('publishes package with provenance session ID', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.PROVENANCE_SESSION_ID });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_FEED': TEST_CONSTANTS.FEED_NAME,
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'PROVENANCE_PROVIDES_SESSION_ID': 'true',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('publishes package when provenance session returns null', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_FEED': TEST_CONSTANTS.FEED_NAME,
                'PROVENANCE_PROVIDES_SESSION_ID': 'false',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('publishes package with provenance session and project-scoped feed', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.PROVENANCE_SESSION_ID, projectName: TEST_CONSTANTS.PROJECT_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_FEED': TEST_CONSTANTS.PROJECT_SCOPED_FEED_NAME,
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'PROVENANCE_PROVIDES_SESSION_ID': 'true',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });
    });

    describe('Authentication', function() {
        this.timeout(10000);

        it('uses WIF token when service connection is specified and WIF succeeds', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download', // download and publish use the same path for auth
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'success',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('falls back to system token when WIF throws error', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'throws',
                'SYSTEM_TOKEN_AVAILABLE': 'true',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('falls back to system token when WIF returns null', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'returns-null',
                'SYSTEM_TOKEN_AVAILABLE': 'true',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('uses pipeline identity when no service connection is specified', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('uses cross-org service URL when organization is specified with service connection', async function() {
            const crossOrgCommandString = buildCommandString({ 
                command: 'download', 
                feed: TEST_CONSTANTS.FEED_NAME,
                serviceUrl: TEST_CONSTANTS.CROSS_ORG_SERVICE_URL
            });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_ORGANIZATION': 'other-org',
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'success',
                'MOCK_SERVICE_URL': TEST_CONSTANTS.CROSS_ORG_SERVICE_URL,
                'EXPECTED_COMMAND_STRING': crossOrgCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString: crossOrgCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });
    });

    describe('Error Handling', function() {
        this.timeout(10000);

        it('fails when no authentication token is available (download)', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'returns-null',
                'SYSTEM_TOKEN_AVAILABLE': 'false',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_AuthenticationFailed'));
        });

        it('fails when no authentication token is available (publish)', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'returns-null',
                'SYSTEM_TOKEN_AVAILABLE': 'false',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_AuthenticationFailed'));
        });

        it('fails when organization is not specified with service connection', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'success',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_OrganizationRequired'));
        });

        it('fails when running against on-premises server', async function() {
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'SYSTEM_SERVERTYPE': 'tfs'
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_UniversalPackagesNotSupportedOnPrem'));
        });
    });

    describe('Feed Permission Validation', function() {
        this.timeout(10000);

        it('validates Reader permissions for download operation (success)', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'PERMISSIONS_VALIDATION_BEHAVIOR': 'success',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('validates Contributor permissions for publish operation (success)', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'PERMISSIONS_VALIDATION_BEHAVIOR': 'success',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('fails when user lacks Reader permissions for download', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'PERMISSIONS_VALIDATION_BEHAVIOR': 'insufficient-permissions',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_FailedToValidateFeed', TEST_CONSTANTS.SERVICE_URL, TEST_CONSTANTS.FEED_NAME));
        });

        it('fails when user lacks Contributor permissions for publish', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'PERMISSIONS_VALIDATION_BEHAVIOR': 'insufficient-permissions',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_FailedToValidateFeed', TEST_CONSTANTS.SERVICE_URL, TEST_CONSTANTS.FEED_NAME));
        });

        it('logs warning and continues when permissions API returns unexpected response', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'PERMISSIONS_VALIDATION_BEHAVIOR': 'unexpected-response',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });

        it('fails when permissions API throws error', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'PERMISSIONS_VALIDATION_BEHAVIOR': 'api-error',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_FailedToValidateFeed', TEST_CONSTANTS.SERVICE_URL, TEST_CONSTANTS.FEED_NAME));
        });

        it('validates permissions for project-scoped feed', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME, projectName: TEST_CONSTANTS.PROJECT_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_FEED': TEST_CONSTANTS.PROJECT_SCOPED_FEED_NAME,
                'PERMISSIONS_VALIDATION_BEHAVIOR': 'success',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: TEST_CONSTANTS.SUCCESS_OUTPUT
            });
        });
    });
});