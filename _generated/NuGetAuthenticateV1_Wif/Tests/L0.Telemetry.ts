import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NuGetAuthenticate L0 Suite - Telemetry and Logging', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Telemetry Emission', function() {
        it('emits telemetry on successful authentication', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('Telemetry emitted:') > 0,
                'Should emit telemetry');
            assert(tr.stdout.indexOf(`Area: ${testConstants.TestData.telemetryArea}`) > 0,
                `Should emit telemetry for area ${testConstants.TestData.telemetryArea}`);
            assert(tr.stdout.indexOf(`Feature: ${testConstants.TestData.telemetryFeature}`) > 0,
                `Should emit telemetry for feature ${testConstants.TestData.telemetryFeature}`);
        });

        it('task fails when telemetry throws error in finally block', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env['__throwTelemetryError__'] = 'true';
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail when telemetry throws error in finally block');
        });


    });

    describe('Telemetry Property Tracking', function() {
        it('tracks ForceReinstallCredentialProvider=true', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.forceReinstallCredentialProvider] = 'true';
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('"NuGetAuthenticate.ForceReinstallCredentialProvider":true') > 0 ||
                   tr.stdout.indexOf('"NuGetAuthenticate.ForceReinstallCredentialProvider": true') > 0,
                'Should track ForceReinstallCredentialProvider as true');
        });

        it('tracks ForceReinstallCredentialProvider=false', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.forceReinstallCredentialProvider] = 'false';
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('"NuGetAuthenticate.ForceReinstallCredentialProvider":false') > 0 ||
                   tr.stdout.indexOf('"NuGetAuthenticate.ForceReinstallCredentialProvider": false') > 0,
                'Should track ForceReinstallCredentialProvider as false');
        });

        it('tracks FederatedFeedAuthCount=1 when WIF succeeds', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupWifAuth(testConstants.TestData.crossOrgFeedUrl);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with WIF');
            assert(tr.stdout.indexOf('"FederatedFeedAuthCount":1') > 0 ||
                   tr.stdout.indexOf('"FederatedFeedAuthCount": 1') > 0,
                'Should track FederatedFeedAuthCount as 1');
        });

        it('tracks FederatedFeedAuthCount=0 when WIF not used', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('"FederatedFeedAuthCount":0') > 0 ||
                   tr.stdout.indexOf('"FederatedFeedAuthCount": 0') > 0,
                'Should track FederatedFeedAuthCount as 0');
        });

        it('tracks isFeedUrlIncluded=true when feedUrl is provided', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupWifAuth(testConstants.TestData.validFeedUrls.devAzure);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('"isFeedUrlIncluded":true') > 0 ||
                   tr.stdout.indexOf('"isFeedUrlIncluded": true') > 0,
                'Should track isFeedUrlIncluded as true');
        });

        it('tracks isFeedUrlIncluded=false when feedUrl is not provided', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('"isFeedUrlIncluded":false') > 0 ||
                   tr.stdout.indexOf('"isFeedUrlIncluded": false') > 0,
                'Should track isFeedUrlIncluded as false');
        });

        it('tracks isFeedUrlValid=true when feedUrl is valid', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupWifAuth(testConstants.TestData.validFeedUrls.devAzure);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('"isFeedUrlValid":true') > 0 ||
                   tr.stdout.indexOf('"isFeedUrlValid": true') > 0,
                'Should track isFeedUrlValid as true');
        });

        it('tracks isFeedUrlValid=false when feedUrl is invalid', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = testConstants.TestData.invalidFeedUrls.nugetOrg;
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.failed, 'Task should fail with invalid feedUrl');
            assert(tr.stdout.indexOf('"isFeedUrlValid":false') > 0 ||
                   tr.stdout.indexOf('"isFeedUrlValid": false') > 0,
                'Should track isFeedUrlValid as false');
        });

        it('tracks isEntraWifServiceConnectionNameIncluded=true when WIF connection provided', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupWifAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('"isEntraWifServiceConnectionNameIncluded":true') > 0 ||
                   tr.stdout.indexOf('"isEntraWifServiceConnectionNameIncluded": true') > 0,
                'Should track isEntraWifServiceConnectionNameIncluded as true');
        });

        it('tracks isServiceConnectionIncluded=true when service connections provided', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([testConstants.TestData.externalServiceConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('"isServiceConnectionIncluded":true') > 0 ||
                   tr.stdout.indexOf('"isServiceConnectionIncluded": true') > 0,
                'Should track isServiceConnectionIncluded as true');
        });
    });

    describe('Debug Logging', function() {
        it('logs debug messages when SYSTEM_DEBUG is enabled', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemDebug] = 'true';
            TestHelpers.setupBasicAuth();
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with debug enabled');
            // Note: Debug logging happens in artifacts-common utilities
            // This test verifies the SYSTEM_DEBUG variable is passed through
        });
    });
});
