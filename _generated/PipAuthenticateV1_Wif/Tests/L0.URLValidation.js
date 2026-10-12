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
describe('PipAuthenticate L0 Suite - Feed URL Handling', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers_1.TestHelpers.beforeEach());
    afterEach(() => TestHelpers_1.TestHelpers.afterEach());
    describe('WIF Feed URL Usage', function () {
        for (const feedUrl of [
            'http://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/simple/',
            'ftp://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/simple/',
            '//pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/simple/',
            'not-a-url',
            'https://pkgs.dev.azure.com.attacker.example/TestFeed/pypi/simple/'
        ]) {
            it(`rejects an insecure or invalid WIF URL: ${feedUrl}`, () => __awaiter(this, void 0, void 0, function* () {
                const tr = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
                process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
                process.env[testConstants.TestEnvVars.feedUrl] = feedUrl;
                process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
                yield tr.runAsync();
                assert(tr.failed);
                assert(tr.errorIssues.length > 0);
                assert(!TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar));
            }));
        }
        it('accepts uppercase HTTPS and normalizes it before adding credentials', () => __awaiter(this, void 0, void 0, function* () {
            const tr = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'HTTPS://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/simple/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            const indexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(indexUrl && new URL(indexUrl).protocol === 'https:');
            assert(!indexUrl.includes('HTTPS://'));
        }));
        it('authenticates with valid Azure DevOps feed URL', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/simple/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
            // Verify the URL is used correctly
            const pipIndexUrl = TestHelpers_1.TestHelpers.extractEnvironmentVariable(tr.stdout, testConstants.TestData.pipIndexUrlVar);
            assert(pipIndexUrl && pipIndexUrl.indexOf('pkgs.dev.azure.com') >= 0, 'PIP_INDEX_URL should contain the Azure DevOps feed URL');
        }));
        it('authenticates with project-scoped feed URL', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'https://pkgs.dev.azure.com/testorg/testproject/_packaging/TestFeed/pypi/simple/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pipIndexUrlVar);
        }));
    });
});
