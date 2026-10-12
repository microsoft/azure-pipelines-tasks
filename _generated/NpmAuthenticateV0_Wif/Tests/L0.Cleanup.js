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
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const TestConstants_1 = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
// ── Helpers ───────────────────────────────────────────────────────────────────
/**
 * Create a SAVE_NPMRC_PATH directory containing an index.json and a backup file
 * in the format NpmrcBackupManager expects: { "nextId": 1, "entries": { "<npmrcPath>": 0 } }
 * with a file named "0" holding the original .npmrc content.
 */
function createSaveDir(npmrcPath, originalContent = 'original=https://registry.npmjs.org/\n') {
    const saveDir = TestHelpers_1.TestHelpers.createTempDir('npm-auth-save-');
    const npmrcStats = fs.statSync(npmrcPath, { bigint: true });
    const index = {
        nextId: 1,
        entries: { [npmrcPath]: 0 },
        identities: {
            [npmrcPath]: {
                device: npmrcStats.dev.toString(),
                inode: npmrcStats.ino.toString()
            }
        }
    };
    fs.writeFileSync(path.join(saveDir, 'index.json'), JSON.stringify(index), 'utf8');
    process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'] =
        JSON.stringify(index.identities[npmrcPath]);
    // Create the backup file that restoreBackedUpFile() will copy back
    fs.writeFileSync(path.join(saveDir, '0'), originalContent, 'utf8');
    return saveDir;
}
// ── Tests ─────────────────────────────────────────────────────────────────────
describe('NpmAuthenticate L0 - Cleanup', function () {
    this.timeout(20000);
    beforeEach(function () {
        TestHelpers_1.TestHelpers.beforeEach();
    });
    afterEach(function () {
        TestHelpers_1.TestHelpers.afterEach();
    });
    it('restores the .npmrc when index.json and working file both exist', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange
        const originalContent = 'registry=https://registry.npmjs.org/\n';
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc('modified-by-task');
        const saveDir = createSaveDir(npmrcPath, originalContent);
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.cleanupSaveNpmrcPath]: saveDir
        }, 'TestSetupCleanup.js');
        // Assert
        TestHelpers_1.TestHelpers.assertSuccess(tr);
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'loc_mock_RevertedChangesToNpmrc');
        // Verify the file was physically restored
        const restoredContent = fs.readFileSync(npmrcPath, 'utf8');
        TestHelpers_1.TestHelpers.assertNpmrcContains(npmrcPath, 'registry=https://registry.npmjs.org/');
    }));
    it('fails closed when the trusted file identity is unavailable', () => __awaiter(this, void 0, void 0, function* () {
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc('modified-by-task');
        const saveDir = createSaveDir(npmrcPath);
        delete process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'];
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.cleanupSaveNpmrcPath]: saveDir
        }, 'TestSetupCleanup.js');
        TestHelpers_1.TestHelpers.assertFailure(tr);
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'loc_mock_NpmrcChangedSinceBackup');
        assert_1.default.strictEqual(fs.readFileSync(npmrcPath, 'utf8'), 'modified-by-task');
        assert_1.default.strictEqual(fs.existsSync(path.join(saveDir, '0')), true);
    }));
    it('logs NoIndexJsonFile when index.json is missing from SAVE_NPMRC_PATH', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange — save dir exists but index.json is absent
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc();
        const saveDir = TestHelpers_1.TestHelpers.createTempDir('npm-auth-save-'); // no index.json written
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.cleanupSaveNpmrcPath]: saveDir,
            [TestConstants_1.TestEnvVars.cleanupIndexShouldExist]: 'false'
        }, 'TestSetupCleanup.js');
        // Assert
        TestHelpers_1.TestHelpers.assertSuccess(tr);
        TestHelpers_1.TestHelpers.assertOutputNotContains(tr, 'loc_mock_RevertedChangesToNpmrc');
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'loc_mock_NoIndexJsonFile');
    }));
    it('logs NoIndexJsonFile when the working .npmrc file does not exist', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange — index.json is present but the .npmrc it references is gone
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc();
        const saveDir = createSaveDir(npmrcPath);
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.cleanupSaveNpmrcPath]: saveDir,
            [TestConstants_1.TestEnvVars.cleanupNpmrcShouldExist]: 'false'
        }, 'TestSetupCleanup.js');
        // Assert
        TestHelpers_1.TestHelpers.assertSuccess(tr);
        TestHelpers_1.TestHelpers.assertOutputNotContains(tr, 'loc_mock_RevertedChangesToNpmrc');
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'loc_mock_NoIndexJsonFile');
    }));
    it('removes the temp directory when SAVE_NPMRC_PATH contains only the index file', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange — after restore, only index.json remains so the rmRF branch triggers.
        // createSaveDir adds both index.json and the backup file "0".
        // After restoreBackedUpFile runs, it deletes "0", leaving only index.json.
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc('modified-by-task');
        const saveDir = createSaveDir(npmrcPath);
        const tempDir = TestHelpers_1.TestHelpers.createTempDir('npm-auth-temp-');
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.cleanupNpmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.cleanupSaveNpmrcPath]: saveDir,
            [TestConstants_1.TestEnvVars.cleanupTempDirectory]: tempDir,
            [TestConstants_1.TestEnvVars.cleanupTempDirExists]: 'true'
        }, 'TestSetupCleanup.js');
        // Assert
        TestHelpers_1.TestHelpers.assertSuccess(tr);
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'loc_mock_RevertedChangesToNpmrc');
    }));
});
