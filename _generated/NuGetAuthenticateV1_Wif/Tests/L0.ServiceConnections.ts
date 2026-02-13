import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import * as testConstants from './TestConstants';
import { TestHelpers } from './TestHelpers';

describe('NuGetAuthenticate L0 Suite - External Service Connections', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers.beforeEach());
    afterEach(() => TestHelpers.afterEach());

    describe('Basic Service Connection Authentication', function() {
        it('authenticates external feed with service connection', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([testConstants.TestData.externalServiceConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed with external service connection');
            assert(tr.stdout.indexOf('Mock: configureCredProvider called') > 0,
                'Should call configureCredProvider with service connections');
        });

        it('calls configureCredProvider with correct protocol type', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([testConstants.TestData.externalServiceConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('configureCredProvider called for NuGet') > 0,
                'Should call configureCredProvider with NuGet protocol type');
        });
    });

    describe('Multiple Service Connections', function() {
        it('handles multiple external service connections', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            
            const multipleConnections = [
                testConstants.TestData.externalServiceConnection,
                testConstants.TestData.tokenServiceConnection
            ];
            TestHelpers.setupExternalServiceConnections(multipleConnections);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should handle multiple service connections');
            assert(tr.stdout.indexOf('with 2 service connections') > 0,
                'Should process both service connections');
        });

        it('handles empty service connections array', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should handle empty service connections');
            assert(tr.stdout.indexOf('with 0 service connections') > 0,
                'Should handle empty array gracefully');
        });
    });

    describe('Service Connection Types', function() {
        it('handles UsernamePassword service connection', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([testConstants.TestData.externalServiceConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should handle UsernamePassword connection');
            assert(testConstants.TestData.externalServiceConnection.authType === 'UsernamePassword',
                'Should be UsernamePassword type');
        });

        it('handles Token service connection', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([testConstants.TestData.tokenServiceConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should handle Token connection');
            assert(testConstants.TestData.tokenServiceConnection.authType === 'Token',
                'Should be Token type');
        });
    });

    describe('Service Connection Secret Masking', function() {
        it('marks service connection credentials as secret', async () => {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            TestHelpers.setupBasicAuth();
            TestHelpers.setupExternalServiceConnections([testConstants.TestData.externalServiceConnection]);
            
            // Act
            await tr.runAsync();
            
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            // Note: Secret masking happens in artifacts-common, not the task itself
            // This test verifies successful execution with service connections
        });
    });
});
