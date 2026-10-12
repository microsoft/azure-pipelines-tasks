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
Object.defineProperty(exports, "__esModule", { value: true });
const tmrm = __importStar(require("azure-pipelines-task-lib/mock-run"));
const path = __importStar(require("path"));
const TestConstants_1 = require("./TestConstants");
delete process.env['SYSTEM_DEBUG'];
const taskPath = path.join(__dirname, '..', 'npmauthcleanup.js');
const tr = new tmrm.TaskMockRunner(taskPath);
const npmrcPath = process.env[TestConstants_1.TestEnvVars.cleanupNpmrcPath] || '';
if (npmrcPath) {
    tr.setInput('workingFile', npmrcPath);
}
const saveNpmrcPath = process.env[TestConstants_1.TestEnvVars.cleanupSaveNpmrcPath] || '';
if (saveNpmrcPath) {
    process.env['SAVE_NPMRC_PATH'] = saveNpmrcPath;
}
const tempDirectory = process.env[TestConstants_1.TestEnvVars.cleanupTempDirectory] || '';
if (tempDirectory) {
    process.env['NPM_AUTHENTICATE_TEMP_DIRECTORY'] = tempDirectory;
}
const indexFilePath = saveNpmrcPath ? path.join(saveNpmrcPath, 'index.json') : '';
const indexShouldExist = process.env[TestConstants_1.TestEnvVars.cleanupIndexShouldExist] !== 'false';
const npmrcShouldExist = process.env[TestConstants_1.TestEnvVars.cleanupNpmrcShouldExist] !== 'false';
const tempDirExists = process.env[TestConstants_1.TestEnvVars.cleanupTempDirExists] === 'true';
const existAnswers = {};
if (indexFilePath) {
    existAnswers[indexFilePath] = indexShouldExist;
}
if (npmrcPath) {
    existAnswers[npmrcPath] = npmrcShouldExist;
}
if (tempDirectory) {
    existAnswers[tempDirectory] = tempDirExists;
}
const rmRFAnswers = {};
if (tempDirectory) {
    rmRFAnswers[tempDirectory] = { success: true };
}
const answers = {
    which: {},
    checkPath: {},
    exist: existAnswers,
    rmRF: rmRFAnswers,
    stats: {}
};
tr.setAnswers(answers);
if (require.main === module) {
    tr.run();
}
