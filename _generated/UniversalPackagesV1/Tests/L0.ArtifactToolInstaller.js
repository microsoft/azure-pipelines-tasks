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
const assert = require("assert");
const testHelpers_1 = require("./testHelpers");
const testConstants_1 = require("./testConstants");
const PRE_JOB_ENV = Object.assign(Object.assign({}, (0, testConstants_1.getDefaultPreJobEnvVars)()), { 'MOCK_PRE_JOB': 'true' });
describe('UniversalPackagesV1 - Artifact Tool Installer (Pre-Job)', function () {
    this.timeout(10000);
    describe('Successful Installation', function () {
        it('installs artifact tool successfully', () => __awaiter(this, void 0, void 0, function* () {
            const tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign({}, PRE_JOB_ENV));
            assert(tr.succeeded, 'Task should have succeeded');
            assert.strictEqual(tr.errorIssues.length, 0, 'Should have no errors');
        }));
        it('sets UPACK_ARTIFACTTOOL_PATH task variable on success', () => __awaiter(this, void 0, void 0, function* () {
            const tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign({}, PRE_JOB_ENV));
            assert(tr.succeeded, 'Task should have succeeded');
            const vars = tr.getSetVariables();
            assert.strictEqual(vars.get('UPACK_ARTIFACTTOOL_PATH'), testConstants_1.TEST_CONSTANTS.ARTIFACT_TOOL_PATH, 'Should set UPACK_ARTIFACTTOOL_PATH task variable');
        }));
        it('caches artifact tool path in pipeline variable', () => __awaiter(this, void 0, void 0, function* () {
            const tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign({}, PRE_JOB_ENV));
            assert(tr.succeeded, 'Task should have succeeded');
            const vars = tr.getSetVariables();
            assert.strictEqual(vars.get('UPACK_ARTIFACTTOOL_PATH'), testConstants_1.TEST_CONSTANTS.ARTIFACT_TOOL_PATH, 'Should cache path in pipeline variable');
        }));
        it('skips installation if artifact tool is already cached', () => __awaiter(this, void 0, void 0, function* () {
            const tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, PRE_JOB_ENV), { 'VSTS_TASKVARIABLE_UPACK_ARTIFACTTOOL_PATH': testConstants_1.TEST_CONSTANTS.ARTIFACT_TOOL_PATH }));
            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdOutContained('loc_mock_Info_ArtifactToolPathResolvedFromCache'), 'Should use cached path');
        }));
    });
    describe('Installation Errors', function () {
        it('fails when running on-premises', () => __awaiter(this, void 0, void 0, function* () {
            const tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, PRE_JOB_ENV), { 'SYSTEM_SERVERTYPE': 'OnPremises' }));
            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('Error_UniversalPackagesNotSupportedOnPrem'), 'Should report on-prem not supported');
        }));
        it('fails when server type is undefined', () => __awaiter(this, void 0, void 0, function* () {
            const envVars = Object.assign({}, PRE_JOB_ENV);
            delete envVars['SYSTEM_SERVERTYPE'];
            const tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', envVars);
            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('Error_UniversalPackagesNotSupportedOnPrem'), 'Should report on-prem not supported');
        }));
        it('fails when artifact tool installation fails', () => __awaiter(this, void 0, void 0, function* () {
            const tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, PRE_JOB_ENV), { 'MOCK_SHOULD_FAIL_INSTALL': 'true' }));
            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('loc_mock_Error_FailedToGetArtifactTool'), 'Should report artifact tool failure');
        }));
        it('fails when blob store URI resolution fails', () => __awaiter(this, void 0, void 0, function* () {
            const tr = yield (0, testHelpers_1.runTestWithEnv)('./testRunner.js', Object.assign(Object.assign({}, PRE_JOB_ENV), { 'MOCK_SHOULD_FAIL_BLOB_URI': 'true' }));
            assert(tr.failed, 'Task should have failed');
            assert(tr.stdOutContained('loc_mock_Error_FailedToGetArtifactTool'), 'Should report artifact tool failure');
        }));
    });
});
