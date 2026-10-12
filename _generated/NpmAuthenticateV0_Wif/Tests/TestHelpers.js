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
exports.TestHelpers = void 0;
const assert_1 = __importDefault(require("assert"));
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const ttm = __importStar(require("azure-pipelines-task-lib/mock-test"));
const TestConstants_1 = require("./TestConstants");
class TestHelpers {
    static createTempDir(prefix = 'npm-auth-tmpdir-') {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
        this._tempDirs.push(tmpDir);
        return tmpDir;
    }
    static createTempNpmrc(content = '') {
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-auth-test-'));
        this._tempDirs.push(tmpDir);
        const npmrcPath = path.join(tmpDir, '.npmrc');
        fs.writeFileSync(npmrcPath, content, 'utf8');
        return npmrcPath;
    }
    static beforeEach() {
        Object.values(TestConstants_1.TestEnvVars).forEach(v => delete process.env[v]);
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['AGENT_BUILDDIRECTORY'];
        delete process.env['SYSTEM_DEBUG'];
        delete process.env['SAVE_NPMRC_PATH'];
        delete process.env['NPM_AUTHENTICATE_TEMP_DIRECTORY'];
        delete process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'];
        delete process.env['EXISTING_ENDPOINTS'];
    }
    static afterEach() {
        Object.values(TestConstants_1.TestEnvVars).forEach(v => delete process.env[v]);
        delete process.env['SYSTEM_ACCESSTOKEN'];
        delete process.env['AGENT_BUILDDIRECTORY'];
        delete process.env['SYSTEM_DEBUG'];
        delete process.env['SAVE_NPMRC_PATH'];
        delete process.env['NPM_AUTHENTICATE_TEMP_DIRECTORY'];
        delete process.env['VSTS_TASKVARIABLE_NPM_AUTHENTICATE_FILE_IDENTITY'];
        delete process.env['EXISTING_ENDPOINTS'];
        for (const dir of this._tempDirs) {
            try {
                fs.rmSync(dir, { recursive: true, force: true });
            }
            catch (_) { }
        }
        this._tempDirs = [];
    }
    static assertSuccess(tr, message) {
        (0, assert_1.default)(tr.succeeded, message || `Task should have succeeded.\nStdout: ${tr.stdout}\nStderr: ${tr.stderr}`);
    }
    static assertFailure(tr, message) {
        (0, assert_1.default)(tr.failed, message || `Task should have failed.\nStdout: ${tr.stdout}\nStderr: ${tr.stderr}`);
    }
    static assertOutputContains(tr, expected, message) {
        (0, assert_1.default)(tr.stdout.includes(expected), message || `Output should contain "${expected}".\nGot: ${tr.stdout}`);
    }
    static assertOutputNotContains(tr, unexpected, message) {
        (0, assert_1.default)(!tr.stdout.includes(unexpected), message || `Output should NOT contain "${unexpected}".\nGot: ${tr.stdout}`);
    }
    static assertWarningIssue(tr, expectedSubstring, message) {
        const found = tr.warningIssues.some(w => w.includes(expectedSubstring));
        (0, assert_1.default)(found, message || `Expected a warning containing "${expectedSubstring}".\nWarnings: ${JSON.stringify(tr.warningIssues)}`);
    }
    static getAppendedAuth(tr, npmrcPath) {
        const filePath = npmrcPath || process.env[TestConstants_1.TestEnvVars.npmrcPath] || '';
        if (!filePath || !fs.existsSync(filePath)) {
            return [];
        }
        return fs.readFileSync(filePath, 'utf8')
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.includes('_authToken=') || l.includes('_password=') || l.includes('always-auth='));
    }
    static assertAuthAppended(tr, expectedSubstring, message) {
        const npmrcFilePath = process.env[TestConstants_1.TestEnvVars.npmrcPath] || '';
        (0, assert_1.default)(npmrcFilePath, 'npmrcPath must be set to check appended auth');
        const content = fs.readFileSync(npmrcFilePath, 'utf8');
        (0, assert_1.default)(content.includes(expectedSubstring), message || `Expected .npmrc to contain "${expectedSubstring}".\nContent:\n${content}`);
    }
    static assertNoAuthAppended(tr, message) {
        const npmrcFilePath = process.env[TestConstants_1.TestEnvVars.npmrcPath] || '';
        if (!npmrcFilePath || !fs.existsSync(npmrcFilePath)) {
            return;
        }
        const content = fs.readFileSync(npmrcFilePath, 'utf8');
        (0, assert_1.default)(!content.includes('_authToken='), message || `Expected no auth but .npmrc contains _authToken.\nContent:\n${content}`);
    }
    static assertNpmrcContains(npmrcPath, expected, message) {
        const content = fs.readFileSync(npmrcPath, 'utf8');
        (0, assert_1.default)(content.includes(expected), message || `Expected .npmrc to contain "${expected}".\nActual content:\n${content}`);
    }
    static assertNpmrcNotContains(npmrcPath, unexpected, message) {
        const content = fs.readFileSync(npmrcPath, 'utf8');
        (0, assert_1.default)(!content.includes(unexpected), message || `Expected .npmrc NOT to contain "${unexpected}".\nActual content:\n${content}`);
    }
    static runTestWithEnv(envVars_1) {
        return __awaiter(this, arguments, void 0, function* (envVars, setupScript = 'TestSetup.js') {
            const tp = path.join(__dirname, setupScript);
            const tr = new ttm.MockTestRunner(tp);
            for (const [key, value] of Object.entries(envVars)) {
                process.env[key] = value;
            }
            yield tr.runAsync();
            return tr;
        });
    }
}
exports.TestHelpers = TestHelpers;
TestHelpers._tempDirs = [];
