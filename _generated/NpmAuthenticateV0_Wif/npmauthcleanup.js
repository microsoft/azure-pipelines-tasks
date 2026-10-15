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
Object.defineProperty(exports, "__esModule", { value: true });
const constants = __importStar(require("./constants"));
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const path = __importStar(require("path"));
const npmrcBackupManager_1 = require("./npmrcBackupManager");
const npmauthutils_1 = require("./npmauthutils");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        tl.setResourcePath(path.join(__dirname, 'task.json'));
        const npmrcPath = tl.getVariable("SAVE_NPMRC_PATH");
        const workingFilePath = tl.getInput(constants.NpmAuthenticateTaskInput.WorkingFile);
        const indexFile = npmrcPath && path.join(npmrcPath, 'index.json');
        if (indexFile && tl.exist(indexFile) && tl.exist(workingFilePath)) {
            const backupManager = npmrcBackupManager_1.NpmrcBackupManager.fromBackupDirectory(npmrcPath);
            const serializedIdentity = tl.getTaskVariable(npmrcBackupManager_1.NpmrcFileIdentityTaskVariable);
            let trustedIdentity;
            try {
                trustedIdentity = serializedIdentity && JSON.parse(serializedIdentity);
            }
            catch (_a) {
                throw new Error(tl.loc('NpmrcChangedSinceBackup', workingFilePath));
            }
            if (!trustedIdentity
                || typeof trustedIdentity.device !== 'string'
                || typeof trustedIdentity.inode !== 'string') {
                throw new Error(tl.loc('NpmrcChangedSinceBackup', workingFilePath));
            }
            const restored = backupManager.restoreBackedUpFile(workingFilePath, trustedIdentity);
            if (restored) {
                (0, npmauthutils_1.writeRepositoryOutput)(tl.loc("RevertedChangesToNpmrc", workingFilePath));
            }
            const tempDirectoryPath = tl.getVariable("NPM_AUTHENTICATE_TEMP_DIRECTORY");
            if (tl.exist(tempDirectoryPath) && backupManager.isOnlyIndexFileRemaining()) {
                tl.rmRF(tempDirectoryPath);
            }
        }
        else {
            (0, npmauthutils_1.writeRepositoryOutput)(tl.loc("NoIndexJsonFile"));
        }
    });
}
run().catch(error => {
    tl.setResult(tl.TaskResult.Failed, error.message);
});
