"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const TestConstants_1 = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
const npmauthutils_1 = require("../npmauthutils");
tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
describe('NpmAuthenticate L0 - Authentication (Integration)', function () {
    this.timeout(20000);
    beforeEach(function () {
        TestHelpers_1.TestHelpers.beforeEach();
    });
    afterEach(function () {
        TestHelpers_1.TestHelpers.afterEach();
    });
    describe('Internal feed authentication', function () {
        it('does not append System.AccessToken for an HTTP registry at an HTTPS packaging host', () => __awaiter(this, void 0, void 0, function* () {
            const internalUrl = new URL(`${TestConstants_1.TestData.collectionUri}_packaging/TestFeed/npm/registry/`);
            internalUrl.protocol = 'http:';
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${internalUrl.href}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertNpmrcNotContains(npmrcPath, TestConstants_1.TestData.systemAccessToken);
            TestHelpers_1.TestHelpers.assertOutputNotContains(tr, 'AddingLocalCredentials');
        }));
        it('appends auth token for a matching internal registry', () => __awaiter(this, void 0, void 0, function* () {
            // The project .npmrc and the target .npmrc are the same file here.
            // The registry host (dev.azure.com) matches the collectionUri host.
            const internalUrl = `${TestConstants_1.TestData.collectionUri}_packaging/TestFeed/npm/registry/`;
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${internalUrl}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestConstants_1.TestData.systemAccessToken}`);
        }));
        it('logs that credentials are being added', () => __awaiter(this, void 0, void 0, function* () {
            const internalUrl = `${TestConstants_1.TestData.collectionUri}_packaging/TestFeed/npm/registry/`;
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${internalUrl}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'AddingLocalCredentials');
        }));
    });
    describe('External service connection authentication', function () {
        it('does not append HTTPS endpoint credentials for an HTTP registry', () => __awaiter(this, void 0, void 0, function* () {
            const registryUrl = new URL(TestConstants_1.TestData.externalRegistryUrl);
            registryUrl.protocol = 'http:';
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${registryUrl.href}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
                [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
                [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertNpmrcNotContains(npmrcPath, TestConstants_1.TestData.externalRegistryToken);
        }));
        it('appends auth token for a matching external registry', () => __awaiter(this, void 0, void 0, function* () {
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.externalRegistryUrl}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
                [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
                [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, `_authToken=${TestConstants_1.TestData.externalRegistryToken}`);
        }));
        it('logs that endpoint credentials are being added', () => __awaiter(this, void 0, void 0, function* () {
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.externalRegistryUrl}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
                [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
                [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'AddingEndpointCredentials');
        }));
    });
    describe('Unmatched registry', function () {
        it('ignores registry when no auth source matches', () => __awaiter(this, void 0, void 0, function* () {
            const unmatchedUrl = 'https://registry.npmjs.org/';
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${unmatchedUrl}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'IgnoringRegistry');
            TestHelpers_1.TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken');
        }));
        it('succeeds with no auth when .npmrc has no registries', () => __awaiter(this, void 0, void 0, function* () {
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc('');
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertNpmrcNotContains(npmrcPath, '_authToken');
        }));
    });
    describe('Duplicate endpoint detection', function () {
        it('warns when external endpoint was already registered in a prior task run', () => __awaiter(this, void 0, void 0, function* () {
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.externalRegistryUrl}`);
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
                [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
                [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken,
                [TestConstants_1.TestEnvVars.existingEndpoints]: TestConstants_1.TestData.externalRegistryUrl
            });
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            TestHelpers_1.TestHelpers.assertWarningIssue(tr, 'DuplicateCredentials', 'Task should warn when the same endpoint is registered twice in the same job');
        }));
    });
    describe('Checked-in credentials', function () {
        it('warns and replaces when .npmrc has checked-in credentials', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange: .npmrc has an external registry with pre-existing auth lines
            // (a common user mistake — committing tokens to source control).
            // The task should warn about overriding them and write fresh auth.
            const npmrcContent = [
                `registry=${TestConstants_1.TestData.externalRegistryUrl}`,
                `//registry.example.com/npm/:_authToken=old-checked-in-token`,
                `//registry.example.com/npm/:always-auth=true`
            ].join('\n');
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(npmrcContent);
            // Act
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
                [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
                [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken
            });
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            // Fresh token should be written, replacing the checked-in one
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, TestConstants_1.TestData.externalRegistryToken);
        }));
    });
    describe('Mixed internal and external registries', function () {
        it('authenticates both internal and external registries in the same .npmrc', () => __awaiter(this, void 0, void 0, function* () {
            // Arrange: .npmrc has two registries — one internal (matches collectionUri host)
            // and one external (resolved via customEndpoint mock)
            const internalUrl = `${TestConstants_1.TestData.collectionUri}_packaging/InternalFeed/npm/registry/`;
            const npmrcContent = [
                `@internal:registry=${internalUrl}`,
                `@external:registry=${TestConstants_1.TestData.externalRegistryUrl}`
            ].join('\n');
            const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(npmrcContent);
            // Act
            const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
                [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
                [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
                [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
                [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken
            });
            // Assert
            TestHelpers_1.TestHelpers.assertSuccess(tr);
            // Internal feed should get System.AccessToken
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, TestConstants_1.TestData.systemAccessToken);
            // External feed should get the endpoint token
            TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, TestConstants_1.TestData.externalRegistryToken);
            // Both credential sources should be logged
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'AddingLocalCredentials');
            TestHelpers_1.TestHelpers.assertOutputContains(tr, 'AddingEndpointCredentials');
        }));
    });
    describe('npmrc file mutations', function () {
        let tempDir;
        beforeEach(function () {
            tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-l0-'));
        });
        afterEach(function () {
            fs.rmSync(tempDir, { recursive: true, force: true });
        });
        it('appends auth entry to npmrc file', function () {
            const npmrcPath = path.join(tempDir, '.npmrc');
            fs.writeFileSync(npmrcPath, 'registry=https://registry.npmjs.org/\n', 'utf8');
            (0, npmauthutils_1.appendAuthToNpmrc)(npmrcPath, '//registry.npmjs.org/:_authToken=test-token');
            const content = fs.readFileSync(npmrcPath, 'utf8');
            (0, assert_1.default)(content.includes('//registry.npmjs.org/:_authToken=test-token'));
        });
        it('removes pre-existing credential lines for the same registry', function () {
            const npmrcPath = path.join(tempDir, '.npmrc');
            const registryUrl = new URL('https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/');
            const lines = [
                'registry=https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/',
                '//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/:_authToken=old-token',
                '//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/:always-auth=true'
            ];
            fs.writeFileSync(npmrcPath, lines.join(os.EOL), 'utf8');
            const updated = (0, npmauthutils_1.removeExistingCredentialEntries)(npmrcPath, [...lines], registryUrl, [registryUrl]);
            assert_1.default.strictEqual(updated[0], lines[0], 'registry= line should be preserved');
            assert_1.default.strictEqual(updated[1], '', 'old auth token line should be blanked');
            assert_1.default.strictEqual(updated[2], '', 'old always-auth line should be blanked');
            const fileContent = fs.readFileSync(npmrcPath, 'utf8');
            (0, assert_1.default)(!fileContent.includes('_authToken=old-token'));
            (0, assert_1.default)(!fileContent.includes('always-auth=true'));
        });
        it('suppresses warning when same URL was already added by a prior iteration', function () {
            const npmrcPath = path.join(tempDir, '.npmrc');
            const registryUrl = new URL('https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/');
            const previouslyAdded = new URL('https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/');
            const lines = [
                '//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/:_authToken=old-token'
            ];
            fs.writeFileSync(npmrcPath, lines.join(os.EOL), 'utf8');
            const updated = (0, npmauthutils_1.removeExistingCredentialEntries)(npmrcPath, [...lines], registryUrl, [previouslyAdded, registryUrl]);
            assert_1.default.strictEqual(updated[0], '', 'old auth should be blanked even for duplicate');
        });
        it('processes separately when scoped and default registries point to different feeds', function () {
            const npmrcPath = path.join(tempDir, '.npmrc');
            const feedAUrl = new URL('https://pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/');
            const feedBUrl = new URL('https://pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/');
            const lines = [
                'registry=https://pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/',
                '//pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/:_authToken=old-tokenA',
                '@scope:registry=https://pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/',
                '//pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/:_authToken=old-tokenB'
            ];
            fs.writeFileSync(npmrcPath, lines.join(os.EOL), 'utf8');
            const afterFeedA = (0, npmauthutils_1.removeExistingCredentialEntries)(npmrcPath, [...lines], feedAUrl, [feedAUrl]);
            assert_1.default.strictEqual(afterFeedA[1], '', 'feedA old auth should be blanked');
            assert_1.default.strictEqual(afterFeedA[3], lines[3], 'feedB auth should be untouched');
            const afterFeedB = (0, npmauthutils_1.removeExistingCredentialEntries)(npmrcPath, [...afterFeedA], feedBUrl, [feedAUrl, feedBUrl]);
            assert_1.default.strictEqual(afterFeedB[3], '', 'feedB old auth should be blanked');
            assert_1.default.strictEqual(afterFeedB[0], lines[0], 'feedA registry= line still preserved');
            assert_1.default.strictEqual(afterFeedB[2], lines[2], 'feedB registry= line still preserved');
        });
    });
});
