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
const fs = require("fs");
const assert = require("assert");
const ttm = require("azure-pipelines-task-lib/mock-test");
const testConstants = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
describe('TwineAuthenticate L0 Suite - Feed URL Handling', function () {
    this.timeout(10000);
    beforeEach(() => TestHelpers_1.TestHelpers.beforeEach());
    afterEach(() => TestHelpers_1.TestHelpers.afterEach());
    describe('WIF Feed URL Usage', function () {
        for (const feedUrl of [
            'http://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/',
            'ftp://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/',
            '//pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/',
            'not-a-url',
            'https://pkgs.dev.azure.com.attacker.example/TestFeed/pypi/upload/'
        ]) {
            it(`rejects an insecure or invalid WIF URL: ${feedUrl}`, () => __awaiter(this, void 0, void 0, function* () {
                const tr = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
                process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
                process.env[testConstants.TestEnvVars.feedUrl] = feedUrl;
                process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
                yield tr.runAsync();
                TestHelpers_1.TestHelpers.assertFailure(tr);
                assert(tr.errorIssues.length > 0);
                TestHelpers_1.TestHelpers.assertEnvironmentVariableNotSet(tr, testConstants.TestData.pypircPathVar);
                assert(!fs.existsSync(path.join(__dirname, 'temp', '.pypirc')));
            }));
        }
        it('accepts uppercase HTTPS and writes a normalized HTTPS repository', () => __awaiter(this, void 0, void 0, function* () {
            const tr = new ttm.MockTestRunner(path.join(__dirname, 'TestSetup.js'));
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'HTTPS://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            const content = fs.readFileSync(path.join(__dirname, 'temp', '.pypirc'), 'utf8');
            assert(content.includes('repository=https://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/'));
            assert(content.includes(testConstants.TestData.wifToken));
        }));
        it('authenticates with valid Azure DevOps feed URL', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'https://pkgs.dev.azure.com/testorg/_packaging/TestFeed/pypi/upload/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        }));
        it('authenticates with project-scoped feed URL', () => __awaiter(this, void 0, void 0, function* () {
            const tp = path.join(__dirname, 'TestSetup.js');
            const tr = new ttm.MockTestRunner(tp);
            process.env[testConstants.TestEnvVars.workloadIdentityServiceConnection] = testConstants.TestData.wifServiceConnection;
            process.env[testConstants.TestEnvVars.feedUrl] = 'https://pkgs.dev.azure.com/testorg/testproject/_packaging/TestFeed/pypi/upload/';
            process.env[testConstants.TestEnvVars.wifToken] = testConstants.TestData.wifToken;
            yield tr.runAsync();
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertEnvironmentVariableSet(tr, testConstants.TestData.pypircPathVar);
        }));
    });
});
