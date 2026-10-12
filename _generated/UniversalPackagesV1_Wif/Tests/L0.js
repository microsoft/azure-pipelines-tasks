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
const path = require("path");
const assert = require("assert");
const tl = require("azure-pipelines-task-lib");
const testHelpers_1 = require("./testHelpers");
const testConstants_1 = require("./testConstants");
// Set resource path to enable localization in tests
tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
// Import pre-job installer tests
require("./L0.ArtifactToolInstaller");
describe('UniversalPackages Suite', function () {
    describe('Download Operations', function () {
        this.timeout(10000);
        it('downloads package from organization-scoped feed', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'download', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'download',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesDownloaded', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('downloads package from project-scoped feed', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'download', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME, projectName: testConstants_1.TEST_CONSTANTS.PROJECT_NAME });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'INPUT_FEED': testConstants_1.TEST_CONSTANTS.PROJECT_SCOPED_FEED_NAME, 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'download',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesDownloaded', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('handles download failure with non-zero exit code', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'download', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'MOCK_EXIT_CODE': '1', 'MOCK_STDERR': testConstants_1.TEST_CONSTANTS.ERROR_MESSAGE, 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'download',
                    shouldSucceed: false,
                    expectedCommandString,
                    expectedMessage: tl.loc('Error_UnexpectedErrorArtifactToolDownload', '1', testConstants_1.TEST_CONSTANTS.ERROR_MESSAGE)
                });
            });
        });
    });
    describe('Publish Operations', function () {
        this.timeout(10000);
        it('publishes package to organization-scoped feed', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'publish', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesPublished', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('publishes package to project-scoped feed', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'publish', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME, projectName: testConstants_1.TEST_CONSTANTS.PROJECT_NAME });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_FEED': testConstants_1.TEST_CONSTANTS.PROJECT_SCOPED_FEED_NAME, 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesPublished', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('handles publish failure with non-zero exit code', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'publish', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'MOCK_EXIT_CODE': '1', 'MOCK_STDERR': testConstants_1.TEST_CONSTANTS.ERROR_MESSAGE, 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: false,
                    expectedCommandString,
                    expectedMessage: tl.loc('Error_UnexpectedErrorArtifactToolPublish', '1', testConstants_1.TEST_CONSTANTS.ERROR_MESSAGE)
                });
            });
        });
        it('publishes package with description', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'publish', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME, description: testConstants_1.TEST_CONSTANTS.PACKAGE_DESCRIPTION });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_PACKAGE_DESCRIPTION': testConstants_1.TEST_CONSTANTS.PACKAGE_DESCRIPTION, 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesPublished', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
    });
    describe('Provenance Session Handling', function () {
        it('publishes package with provenance session ID', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({
                    command: 'publish',
                    feed: testConstants_1.TEST_CONSTANTS.PROVENANCE_SESSION_ID,
                    serviceUrl: testConstants_1.TEST_CONSTANTS.FEED_URL
                });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_FEED': testConstants_1.TEST_CONSTANTS.FEED_NAME, 'INPUT_FEEDURL': testConstants_1.TEST_CONSTANTS.FEED_URL, 'INPUT_ADOSERVICECONNECTION': testConstants_1.TEST_CONSTANTS.SERVICE_CONNECTION_NAME, 'WIF_AUTH_BEHAVIOR': 'success', 'PROVENANCE_PROVIDES_SESSION_ID': 'true', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesPublished', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('publishes package when provenance session returns null', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'publish', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_FEED': testConstants_1.TEST_CONSTANTS.FEED_NAME, 'PROVENANCE_PROVIDES_SESSION_ID': 'false', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesPublished', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('publishes package with provenance session and project-scoped feed', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({
                    command: 'publish',
                    feed: testConstants_1.TEST_CONSTANTS.PROVENANCE_SESSION_ID,
                    projectName: testConstants_1.TEST_CONSTANTS.PROJECT_NAME,
                    serviceUrl: testConstants_1.TEST_CONSTANTS.FEED_URL
                });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_FEED': testConstants_1.TEST_CONSTANTS.PROJECT_SCOPED_FEED_NAME, 'INPUT_FEEDURL': testConstants_1.TEST_CONSTANTS.FEED_URL, 'INPUT_ADOSERVICECONNECTION': testConstants_1.TEST_CONSTANTS.SERVICE_CONNECTION_NAME, 'WIF_AUTH_BEHAVIOR': 'success', 'PROVENANCE_PROVIDES_SESSION_ID': 'true', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesPublished', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
    });
    describe('Authentication', function () {
        this.timeout(10000);
        it('uses WIF token when service connection is specified and WIF succeeds', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({
                    command: 'download',
                    feed: testConstants_1.TEST_CONSTANTS.FEED_NAME,
                    serviceUrl: testConstants_1.TEST_CONSTANTS.FEED_URL
                });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'INPUT_FEEDURL': testConstants_1.TEST_CONSTANTS.FEED_URL, 'INPUT_ADOSERVICECONNECTION': testConstants_1.TEST_CONSTANTS.SERVICE_CONNECTION_NAME, 'WIF_AUTH_BEHAVIOR': 'success', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'download',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesDownloaded', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('fails when WIF throws error and service connection is specified', function () {
            return __awaiter(this, void 0, void 0, function* () {
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'INPUT_FEEDURL': testConstants_1.TEST_CONSTANTS.FEED_URL, 'INPUT_ADOSERVICECONNECTION': testConstants_1.TEST_CONSTANTS.SERVICE_CONNECTION_NAME, 'WIF_AUTH_BEHAVIOR': 'throws', 'SYSTEM_TOKEN_AVAILABLE': 'true' }));
                (0, testHelpers_1.assertTaskFailedBeforeToolExecution)(tr, tl.loc('Error_AuthenticationFailed'));
            });
        });
        it('fails when WIF returns null and service connection is specified', function () {
            return __awaiter(this, void 0, void 0, function* () {
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'INPUT_FEEDURL': testConstants_1.TEST_CONSTANTS.FEED_URL, 'INPUT_ADOSERVICECONNECTION': testConstants_1.TEST_CONSTANTS.SERVICE_CONNECTION_NAME, 'WIF_AUTH_BEHAVIOR': 'returns-null', 'SYSTEM_TOKEN_AVAILABLE': 'true' }));
                (0, testHelpers_1.assertTaskFailedBeforeToolExecution)(tr, tl.loc('Error_AuthenticationFailed'));
            });
        });
        it('rejects an insecure feed service before exporting a WIF token', function () {
            return __awaiter(this, void 0, void 0, function* () {
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'INPUT_FEEDURL': testConstants_1.TEST_CONSTANTS.FEED_URL, 'INPUT_ADOSERVICECONNECTION': testConstants_1.TEST_CONSTANTS.SERVICE_CONNECTION_NAME, 'WIF_AUTH_BEHAVIOR': 'success', 'MOCK_FEED_SERVICE_URL': 'http://feeds.example.test/' }));
                (0, testHelpers_1.assertTaskFailedBeforeToolExecution)(tr, tl.loc('Error_AuthenticationFailed'));
            });
        });
        it('uses pipeline identity when no service connection is specified', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'download', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'download',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesDownloaded', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('requires a feed URL when a service connection is specified', function () {
            return __awaiter(this, void 0, void 0, function* () {
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'INPUT_ADOSERVICECONNECTION': testConstants_1.TEST_CONSTANTS.SERVICE_CONNECTION_NAME, 'WIF_AUTH_BEHAVIOR': 'success' }));
                (0, testHelpers_1.assertTaskFailedBeforeToolExecution)(tr, tl.loc('Error_AuthenticationFailed'));
            });
        });
        it('uses the target Azure Artifacts organization URL for a cross-org feed', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({
                    command: 'download',
                    feed: testConstants_1.TEST_CONSTANTS.FEED_NAME,
                    serviceUrl: testConstants_1.TEST_CONSTANTS.CROSS_ORG_FEED_URL
                });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'INPUT_FEEDURL': testConstants_1.TEST_CONSTANTS.CROSS_ORG_FEED_URL, 'INPUT_ADOSERVICECONNECTION': testConstants_1.TEST_CONSTANTS.SERVICE_CONNECTION_NAME, 'WIF_AUTH_BEHAVIOR': 'success', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'download',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesDownloaded', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
    });
    describe('Error Handling', function () {
        this.timeout(10000);
        it('fails when no authentication token is available (download)', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'download', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'INPUT_FEEDURL': testConstants_1.TEST_CONSTANTS.FEED_URL, 'INPUT_ADOSERVICECONNECTION': testConstants_1.TEST_CONSTANTS.SERVICE_CONNECTION_NAME, 'WIF_AUTH_BEHAVIOR': 'returns-null', 'SYSTEM_TOKEN_AVAILABLE': 'false', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertTaskFailedBeforeToolExecution)(tr, tl.loc('Error_AuthenticationFailed'));
            });
        });
        it('fails when no authentication token is available (publish)', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'publish', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_FEEDURL': testConstants_1.TEST_CONSTANTS.FEED_URL, 'INPUT_ADOSERVICECONNECTION': testConstants_1.TEST_CONSTANTS.SERVICE_CONNECTION_NAME, 'WIF_AUTH_BEHAVIOR': 'returns-null', 'SYSTEM_TOKEN_AVAILABLE': 'false', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertTaskFailedBeforeToolExecution)(tr, tl.loc('Error_AuthenticationFailed'));
            });
        });
        it('fails when running against on-premises server', function () {
            return __awaiter(this, void 0, void 0, function* () {
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'SYSTEM_SERVERTYPE': 'tfs' }));
                (0, testHelpers_1.assertTaskFailedBeforeToolExecution)(tr, tl.loc('Error_UniversalPackagesNotSupportedOnPrem'));
            });
        });
        it('downloads artifact tool inline when pre-job did not cache it', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({ command: 'download', feed: testConstants_1.TEST_CONSTANTS.FEED_NAME });
                const tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'VSTS_TASKVARIABLE_UPACK_ARTIFACTTOOL_PATH': '', 'INPUT_COMMAND': 'download', 'EXPECTED_COMMAND_STRING': expectedCommandString }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'download',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesDownloaded', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
                // Verify the resolver installed the artifact tool inline and cached the path
                const vars = tr.getSetVariables();
                assert.strictEqual(vars.get('UPACK_ARTIFACTTOOL_PATH'), testConstants_1.TEST_CONSTANTS.ARTIFACT_TOOL_PATH, 'should have installed and cached artifact tool path');
            });
        });
    });
    describe('Version Input Validation', function () {
        this.timeout(10000);
        it('fails download when packageVersion is not specified', function () {
            return __awaiter(this, void 0, void 0, function* () {
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'download', 'INPUT_PACKAGEVERSION': '' // Empty string means not provided
                 }));
                (0, testHelpers_1.assertTaskFailedBeforeToolExecution)(tr, tl.loc('Error_PackageVersionRequired'));
            });
        });
        it('fails publish when neither packageVersion nor versionIncrement is specified', function () {
            return __awaiter(this, void 0, void 0, function* () {
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_PACKAGEVERSION': '' // Empty string means not provided
                 }));
                (0, testHelpers_1.assertTaskFailedBeforeToolExecution)(tr, tl.loc('Error_VersionInputRequired'));
            });
        });
        it('fails publish when both packageVersion and versionIncrement are specified', function () {
            return __awaiter(this, void 0, void 0, function* () {
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_PACKAGEVERSION': testConstants_1.TEST_CONSTANTS.PACKAGE_VERSION, 'INPUT_VERSIONINCREMENT': 'patch' }));
                (0, testHelpers_1.assertTaskFailedBeforeToolExecution)(tr, tl.loc('Error_VersionInputsMutuallyExclusive'));
            });
        });
    });
    describe('Version Increment', function () {
        this.timeout(10000);
        it('increments patch version when versionIncrement is patch', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({
                    command: 'publish',
                    feed: testConstants_1.TEST_CONSTANTS.FEED_NAME,
                    packageVersion: '1.2.4' // 1.2.3 + patch = 1.2.4
                });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_PACKAGEVERSION': '', 'INPUT_VERSIONINCREMENT': 'patch', 'MOCK_EXPECTED_VERSION': '1.2.4' }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesPublished', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, '1.2.4', testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('increments minor version when versionIncrement is minor', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({
                    command: 'publish',
                    feed: testConstants_1.TEST_CONSTANTS.FEED_NAME,
                    packageVersion: '1.3.0' // 1.2.3 + minor = 1.3.0
                });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_PACKAGEVERSION': '', 'INPUT_VERSIONINCREMENT': 'minor', 'MOCK_EXPECTED_VERSION': '1.3.0' }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesPublished', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, '1.3.0', testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('increments major version when versionIncrement is major', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({
                    command: 'publish',
                    feed: testConstants_1.TEST_CONSTANTS.FEED_NAME,
                    packageVersion: '2.0.0' // 1.2.3 + major = 2.0.0
                });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_PACKAGEVERSION': '', 'INPUT_VERSIONINCREMENT': 'major', 'MOCK_EXPECTED_VERSION': '2.0.0' }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesPublished', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, '2.0.0', testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
        it('starts at 0.0.1 when package does not exist and versionIncrement is patch', function () {
            return __awaiter(this, void 0, void 0, function* () {
                const expectedCommandString = (0, testHelpers_1.buildCommandString)({
                    command: 'publish',
                    feed: testConstants_1.TEST_CONSTANTS.FEED_NAME,
                    packageVersion: '0.0.1' // null + patch = 0.0.1
                });
                let tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, (0, testConstants_1.getDefaultEnvVars)()), { 'INPUT_COMMAND': 'publish', 'INPUT_PACKAGEVERSION': '', 'INPUT_VERSIONINCREMENT': 'patch', 'MOCK_HIGHEST_PACKAGE_VERSION': '0.0.0', 'MOCK_EXPECTED_VERSION': '0.0.1' }));
                (0, testHelpers_1.assertArtifactToolCommand)({
                    tr,
                    command: 'publish',
                    shouldSucceed: true,
                    expectedCommandString,
                    expectedMessage: tl.loc('Success_PackagesPublished', testConstants_1.TEST_CONSTANTS.PACKAGE_NAME, '0.0.1', testConstants_1.TEST_CONSTANTS.FEED_NAME)
                });
            });
        });
    });
});
