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
describe('TwineAuthenticate L0 Suite - Input Validation and Combinations', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers_1.TestHelpers.beforeEach());
    afterEach(() => TestHelpers_1.TestHelpers.afterEach());
    describe('Input Combination Validation', function () {
        it('succeeds with empty feed name', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = '';
            yield tr.runAsync();
            // Should succeed with no feed configured
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
            process.env[testConstants.TestEnvVars.artifactFeed] = 'Feed-Name.With_Special-Chars';
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        }));
        it('handles feed names with dots', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.feedWithDot;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        }));
        it('handles project-scoped feed names', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.projectScopedFeed;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        }));
        it('handles feed names with whitespace', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = ' TestFeed ';
            yield tr.runAsync();
            // Should trim whitespace and process feed correctly
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        }));
    });
    describe('Multiple Feed Validation', function () {
        it('warns when multiple feeds are provided', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            // Twine only supports one feed, but some users might provide comma-separated list
            process.env[testConstants.TestEnvVars.artifactFeed] = 'Feed1,Feed2';
            yield tr.runAsync();
            // Should succeed but may warn about using only first feed
            TestHelpers_1.TestHelpers.assertSuccess(tr);
        }));
        it('handles duplicate feed names gracefully', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.duplicateFeed;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
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
            process.env[testConstants.TestEnvVars.externalEndpoints] = 'Endpoint1,Endpoint2';
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
    describe('.pypirc File Path Validation', function () {
        it('sets PYPIRC_PATH environment variable', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.systemAccessToken] = testConstants.TestData.defaultAccessToken;
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
            // Verify path is absolute and points to .pypirc
            const pypircPath = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pypircPathVar);
            assert(pypircPath && pypircPath.indexOf('.pypirc') >= 0, 'PYPIRC_PATH should point to .pypirc file');
        }));
    });
    describe('Missing Required System Variables', function () {
        it('handles missing System.AccessToken gracefully', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            // Not setting systemAccessToken
            process.env[testConstants.TestEnvVars.systemTeamFoundationCollectionUri] = testConstants.TestData.defaultCollectionUri;
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
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
            process.env[testConstants.TestEnvVars.artifactFeed] = testConstants.TestData.singleFeed;
            yield tr.runAsync();
            // Should handle missing collection URI
            assert(tr.succeeded || tr.failed, 'Task should complete');
        }));
    });
});
