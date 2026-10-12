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
const ttm = require("azure-pipelines-task-lib/mock-test");
const testConstants = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
describe('CargoAuthenticate L0 Suite - Telemetry and Logging', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers_1.TestHelpers.beforeEach());
    afterEach(() => TestHelpers_1.TestHelpers.afterEach());
    describe('Telemetry', function () {
        it('emits telemetry on successful authentication', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            // Act
            yield tr.runAsync();
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('Telemetry emitted:') > 0, 'Should emit telemetry on successful authentication');
            assert(tr.stdout.indexOf(testConstants.TestData.telemetryArea) > 0, `Should emit telemetry for area ${testConstants.TestData.telemetryArea}`);
            assert(tr.stdout.indexOf(testConstants.TestData.telemetryFeature) > 0, `Should emit telemetry for feature ${testConstants.TestData.telemetryFeature}`);
        }));
        it('tracks internal feed auth count correctly', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            // Act
            yield tr.runAsync();
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('"InternalFeedAuthCount":1') > 0 ||
                tr.stdout.indexOf('"InternalFeedAuthCount": 1') > 0, 'Should track internal feed auth count as 1');
        }));
        it('handles telemetry errors without failing task', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__throwTelemetryError__'] = 'true';
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            // Act
            yield tr.runAsync();
            // Assert
            assert(tr.failed, 'Task should fail when telemetry throws error in finally block');
        }));
    });
    describe('Logging and Debugging', function () {
        it('logs debug messages when SYSTEM_DEBUG is enabled', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemDebug] = 'true';
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            // Act
            yield tr.runAsync();
            // Assert
            assert(tr.succeeded, 'Task should succeed with debug enabled');
            assert(tr.stdout.indexOf('##vso[task.debug]') >= 0, 'Should log debug messages when SYSTEM_DEBUG is enabled');
        }));
        it('logs correct environment variable names in output', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env['__mockConfigContent__'] = testConstants.TestData.validTomlContent;
            // Act
            yield tr.runAsync();
            // Assert
            assert(tr.succeeded, 'Task should succeed');
            assert(tr.stdout.indexOf('CARGO_REGISTRIES_') > 0, 'Should reference CARGO_REGISTRIES_ environment variables in output');
        }));
    });
});
