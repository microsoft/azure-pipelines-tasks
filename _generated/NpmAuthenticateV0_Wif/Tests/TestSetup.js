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
const tmrm = __importStar(require("azure-pipelines-task-lib/mock-run"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const TestConstants_1 = require("./TestConstants");
delete process.env['SYSTEM_DEBUG'];
const taskPath = path.join(__dirname, '..', 'npmauth.js');
const tr = new tmrm.TaskMockRunner(taskPath);
const npmrcPath = process.env[TestConstants_1.TestEnvVars.npmrcPath] || '';
if (npmrcPath) {
    tr.setInput('workingFile', npmrcPath);
}
if (process.env[TestConstants_1.TestEnvVars.customEndpoint]) {
    tr.setInput('customEndpoint', process.env[TestConstants_1.TestEnvVars.customEndpoint]);
}
if (process.env[TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]) {
    tr.setInput('workloadIdentityServiceConnection', process.env[TestConstants_1.TestEnvVars.workloadIdentityServiceConnection]);
}
if (process.env[TestConstants_1.TestEnvVars.wifRegistryUrl]) {
    tr.setInput('feedUrl', process.env[TestConstants_1.TestEnvVars.wifRegistryUrl]);
}
process.env['SYSTEM_ACCESSTOKEN'] =
    process.env[TestConstants_1.TestEnvVars.systemAccessToken] || TestConstants_1.TestData.systemAccessToken;
if (process.env[TestConstants_1.TestEnvVars.existingEndpoints]) {
    process.env['EXISTING_ENDPOINTS'] = process.env[TestConstants_1.TestEnvVars.existingEndpoints];
}
process.env['AGENT_BUILDDIRECTORY'] = os.tmpdir();
// Pre-create SAVE_NPMRC_PATH to avoid mkdtempSync issues in mock mode
const _saveNpmrcBase = path.join(os.tmpdir(), 'npmAuthenticate');
if (!fs.existsSync(_saveNpmrcBase)) {
    fs.mkdirSync(_saveNpmrcBase, { recursive: true });
}
const _saveNpmrcPath = fs.mkdtempSync(_saveNpmrcBase + path.sep);
process.env['SAVE_NPMRC_PATH'] = _saveNpmrcPath;
// SYSTEMVSSCONNECTION for resolveInternalFeedCredentials
process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = TestConstants_1.TestData.systemAccessToken;
process.env['ENDPOINT_AUTH_SCHEME_SYSTEMVSSCONNECTION'] = 'OAuth';
const packagingLocationShouldFail = process.env[TestConstants_1.TestEnvVars.packagingLocationShouldFail] === 'true';
tr.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', {
    getPackagingUris: function () {
        return __awaiter(this, void 0, void 0, function* () {
            if (packagingLocationShouldFail) {
                throw new Error('Simulated packaging location failure');
            }
            return { PackagingUris: [TestConstants_1.TestData.collectionUri] };
        });
    },
    ProtocolType: { Npm: 1 }
});
const throwTelemetryError = process.env[TestConstants_1.TestEnvVars.throwTelemetryError] === 'true';
tr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: function (area, feature, data) {
        if (throwTelemetryError) {
            throw new Error('Simulated telemetry error');
        }
        console.log(`${TestConstants_1.TestData.telemetryPrefix}${area}.${feature}:${JSON.stringify(data)}`);
    }
});
const wifToken = process.env[TestConstants_1.TestEnvVars.wifToken];
const wifShouldFail = process.env[TestConstants_1.TestEnvVars.wifShouldFail] === 'true';
tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {
    getFederatedWorkloadIdentityCredentialsForFeed: function (serviceConnectionName, feedUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (wifShouldFail) {
                throw new Error(`Simulated WIF failure for ${serviceConnectionName}`);
            }
            const verifiedFeedUrl = new URL(feedUrl);
            if (verifiedFeedUrl.protocol !== 'https:' ||
                !verifiedFeedUrl.hostname.toLowerCase().endsWith('dev.azure.com')) {
                throw new Error('Error_FeedUrlUntrustedHost');
            }
            return wifToken ? { accessToken: wifToken, feedUrl: verifiedFeedUrl } : undefined;
        });
    }
});
// Mock http/https for isEndpointInternal probe (returns non-Azure DevOps response)
const mockHttpModule = {
    get: function (_url, _options, callback) {
        const mockResponse = {
            rawHeaders: ['Content-Type', 'application/json'],
            resume: function () { }
        };
        if (callback) {
            callback(mockResponse);
        }
        return { on: function () { } };
    }
};
tr.registerMock('https', mockHttpModule);
tr.registerMock('http', mockHttpModule);
// Mock npmrcCredential for external endpoint tests to avoid needing
// real ENDPOINT_AUTH_* env vars in the basic integration tests
const extUrl = process.env[TestConstants_1.TestEnvVars.externalRegistryUrl] || '';
const extToken = process.env[TestConstants_1.TestEnvVars.externalRegistryToken] || '';
const customEndpoint = process.env[TestConstants_1.TestEnvVars.customEndpoint] || '';
if (customEndpoint) {
    tr.registerMock('./npmrcCredential', {
        resolveServiceEndpointCredential: function () {
            return __awaiter(this, void 0, void 0, function* () {
                const nerfDart = extUrl.replace(/^https?:/, '');
                return {
                    url: extUrl,
                    auth: `${nerfDart}:_authToken=${extToken}`
                };
            });
        },
        NpmrcCredential: {}
    });
}
const npmrcShouldExist = process.env[TestConstants_1.TestEnvVars.npmrcShouldExist] !== 'false';
const answers = {
    which: {},
    checkPath: {},
    exist: { [npmrcPath]: npmrcShouldExist },
    stats: {}
};
tr.setAnswers(answers);
if (require.main === module) {
    tr.run();
}
