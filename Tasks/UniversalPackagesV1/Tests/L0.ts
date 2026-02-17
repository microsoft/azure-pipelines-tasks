import * as path from 'path';
import * as tl from 'azure-pipelines-task-lib';
import {runTestWithEnv, assertArtifactToolCommand, assertTaskFailedBeforeToolExecution, buildCommandString } from './testHelpers';
import { TEST_CONSTANTS, getDefaultEnvVars } from './testConstants';

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
                expectedMessage: tl.loc('Success_PackagesDownloaded', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
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
                expectedMessage: tl.loc('Success_PackagesDownloaded', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
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
                expectedMessage: tl.loc('Success_PackagesPublished', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
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
                expectedMessage: tl.loc('Success_PackagesPublished', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
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
                expectedMessage: tl.loc('Success_PackagesPublished', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
            });
        });
    });

    describe('Provenance Session Handling', function() {
#if WIF
        it('publishes package with provenance session ID', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.PROVENANCE_SESSION_ID });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_FEED': TEST_CONSTANTS.FEED_NAME,
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'success',
                'PROVENANCE_PROVIDES_SESSION_ID': 'true',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: tl.loc('Success_PackagesPublished', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
            });
        });
#endif

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
                expectedMessage: tl.loc('Success_PackagesPublished', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
            });
        });

#if WIF
        it('publishes package with provenance session and project-scoped feed', async function() {
            const expectedCommandString = buildCommandString({ command: 'publish', feed: TEST_CONSTANTS.PROVENANCE_SESSION_ID, projectName: TEST_CONSTANTS.PROJECT_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_FEED': TEST_CONSTANTS.PROJECT_SCOPED_FEED_NAME,
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'success',
                'PROVENANCE_PROVIDES_SESSION_ID': 'true',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: tl.loc('Success_PackagesPublished', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
            });
        });
#endif
    });

    describe('Authentication', function() {
        this.timeout(10000);

#if WIF
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
                expectedMessage: tl.loc('Success_PackagesDownloaded', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
            });
        });

        it('fails when WIF throws error and service connection is specified', async function() {
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'throws',
                'SYSTEM_TOKEN_AVAILABLE': 'true'
            });
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_AuthenticationFailed'));
        });

        it('fails when WIF returns null and service connection is specified', async function() {
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_ORGANIZATION': TEST_CONSTANTS.ORGANIZATION_NAME,
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'returns-null',
                'SYSTEM_TOKEN_AVAILABLE': 'true'
            });
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_AuthenticationFailed'));
        });
#endif

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
                expectedMessage: tl.loc('Success_PackagesDownloaded', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
            });
        });

#if WIF
        it('uses pipeline organization when organization is not specified with service connection', async function() {
            const expectedCommandString = buildCommandString({ command: 'download', feed: TEST_CONSTANTS.FEED_NAME });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_ADOSERVICECONNECTION': TEST_CONSTANTS.SERVICE_CONNECTION_NAME,
                'WIF_AUTH_BEHAVIOR': 'success',
                'EXPECTED_COMMAND_STRING': expectedCommandString
            });
            
            assertArtifactToolCommand({
                tr,
                command: 'download',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: tl.loc('Success_PackagesDownloaded', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
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
                expectedMessage: tl.loc('Success_PackagesDownloaded', TEST_CONSTANTS.PACKAGE_NAME, TEST_CONSTANTS.PACKAGE_VERSION, TEST_CONSTANTS.FEED_NAME)
            });
        });
#endif
    });

    describe('Error Handling', function() {
        this.timeout(10000);

#if WIF
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

#endif

        it('fails when running against on-premises server', async function() {
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'SYSTEM_SERVERTYPE': 'tfs'
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_UniversalPackagesNotSupportedOnPrem'));
        });
    });

    describe('Version Input Validation', function() {
        this.timeout(10000);

        it('fails download when packageVersion is not specified', async function() {
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'download',
                'INPUT_PACKAGEVERSION': ''  // Empty string means not provided
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_PackageVersionRequired'));
        });

        it('fails publish when neither packageVersion nor versionIncrement is specified', async function() {
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_PACKAGEVERSION': ''  // Empty string means not provided
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_VersionInputRequired'));
        });

        it('fails publish when both packageVersion and versionIncrement are specified', async function() {
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_PACKAGEVERSION': TEST_CONSTANTS.PACKAGE_VERSION,
                'INPUT_VERSIONINCREMENT': 'patch'
            });
            
            assertTaskFailedBeforeToolExecution(tr, tl.loc('Error_VersionInputsMutuallyExclusive'));
        });
    });

    describe('Version Increment', function() {
        this.timeout(10000);

        it('increments patch version when versionIncrement is patch', async function() {
            const expectedCommandString = buildCommandString({ 
                command: 'publish', 
                feed: TEST_CONSTANTS.FEED_NAME,
                packageVersion: '1.2.4'  // 1.2.3 + patch = 1.2.4
            });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_PACKAGEVERSION': '',
                'INPUT_VERSIONINCREMENT': 'patch',
                'MOCK_EXPECTED_VERSION': '1.2.4'
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: tl.loc('Success_PackagesPublished', TEST_CONSTANTS.PACKAGE_NAME, '1.2.4', TEST_CONSTANTS.FEED_NAME)
            });
        });

        it('increments minor version when versionIncrement is minor', async function() {
            const expectedCommandString = buildCommandString({ 
                command: 'publish', 
                feed: TEST_CONSTANTS.FEED_NAME,
                packageVersion: '1.3.0'  // 1.2.3 + minor = 1.3.0
            });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_PACKAGEVERSION': '',
                'INPUT_VERSIONINCREMENT': 'minor',
                'MOCK_EXPECTED_VERSION': '1.3.0'
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: tl.loc('Success_PackagesPublished', TEST_CONSTANTS.PACKAGE_NAME, '1.3.0', TEST_CONSTANTS.FEED_NAME)
            });
        });

        it('increments major version when versionIncrement is major', async function() {
            const expectedCommandString = buildCommandString({ 
                command: 'publish', 
                feed: TEST_CONSTANTS.FEED_NAME,
                packageVersion: '2.0.0'  // 1.2.3 + major = 2.0.0
            });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_PACKAGEVERSION': '',
                'INPUT_VERSIONINCREMENT': 'major',
                'MOCK_EXPECTED_VERSION': '2.0.0'
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: tl.loc('Success_PackagesPublished', TEST_CONSTANTS.PACKAGE_NAME, '2.0.0', TEST_CONSTANTS.FEED_NAME)
            });
        });

        it('starts at 0.0.1 when package does not exist and versionIncrement is patch', async function() {
            const expectedCommandString = buildCommandString({ 
                command: 'publish', 
                feed: TEST_CONSTANTS.FEED_NAME,
                packageVersion: '0.0.1'  // null + patch = 0.0.1
            });
            let tr = await runTestWithEnv('./testRunner.js', {
                ...getDefaultEnvVars(),
                'INPUT_COMMAND': 'publish',
                'INPUT_PACKAGEVERSION': '',
                'INPUT_VERSIONINCREMENT': 'patch',
                'MOCK_HIGHEST_PACKAGE_VERSION': '0.0.0',  // Simulates new package
                'MOCK_EXPECTED_VERSION': '0.0.1'
            });
            assertArtifactToolCommand({
                tr,
                command: 'publish',
                shouldSucceed: true,
                expectedCommandString,
                expectedMessage: tl.loc('Success_PackagesPublished', TEST_CONSTANTS.PACKAGE_NAME, '0.0.1', TEST_CONSTANTS.FEED_NAME)
            });
        });
    });
});