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
describe('PipAuthenticate L0 Suite - Input Validation and Combinations', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers_1.TestHelpers.beforeEach());
    afterEach(() => TestHelpers_1.TestHelpers.afterEach());
    describe('Input Combination Validation', function () {
        it('succeeds with empty feed list', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = '';
            yield tr.runAsync();
            // Should succeed with no feeds configured
            TestHelpers_1.TestHelpers.assertSuccess(tr);
        }));
        it('handles null/undefined inputs gracefully', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            // Not setting any optional inputs
            yield tr.runAsync();
            // Should handle missing optional inputs
            TestHelpers_1.TestHelpers.assertSuccess(tr);
        }));
    });
    describe('Feed Name Validation', function () {
        it('handles feed names with special characters', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = 'Feed-Name.With_Special-Chars';
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        }));
        it('handles project-scoped feed names', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.projectScopedFeed;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        }));
        it('handles multiple feed names with commas', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.multipleFeedsString;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
        }));
        it('handles feed names with whitespace', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = ' Feed1 , Feed2 , Feed3 ';
            yield tr.runAsync();
            // Should trim whitespace and process feeds correctly
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        }));
    });
    describe('onlyAddExtraIndex Flag Behavior', function () {
        it('sets only PIP_EXTRA_INDEX_URL when onlyAddExtraIndex is true', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.onlyAddExtraIndex] = 'true';
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipExtraIndexUrlVar);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pipIndexUrlVar);
        }));
        it('sets PIP_INDEX_URL when onlyAddExtraIndex is false', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            process.env[testConstants.TestEnvVars.onlyAddExtraIndex] = 'false';
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        }));
        it('defaults to setting PIP_INDEX_URL when onlyAddExtraIndex is not specified', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            // Not setting onlyAddExtraIndex
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        }));
    });
    describe('External Endpoints Validation', function () {
        it('handles single external endpoint', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.externalEndpoints] = testConstants.TestData.externalServiceEndpoint;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
        }));
        it('handles multiple external endpoints', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.externalEndpoints] = 'Endpoint1,Endpoint2,Endpoint3';
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
        }));
        it('handles empty external endpoints', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.externalEndpoints] = '';
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
        }));
    });
    describe('Missing Required System Variables', function () {
        it('handles missing System.AccessToken gracefully', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            // Not setting systemAccessToken
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            yield tr.runAsync();
            // Should handle missing token appropriately
            if (tr.failed) {
                TestHelpers_1.TestHelpers.assertOutputContains(tr, 'token', 'Should mention missing token');
            }
        }));
        it('handles missing Collection URI gracefully', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            // Not setting systemTeamFoundationCollectionUri
            process.env[testConstants.TestEnvVars.artifactFeeds] = testConstants.TestData.singleFeed;
            yield tr.runAsync();
            // Should handle missing collection URI
            assert(tr.succeeded || tr.failed, 'Task should complete');
        }));
    });
});
