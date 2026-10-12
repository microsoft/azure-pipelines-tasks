"use strict";
// Test setup that exercises the REAL npmrcCredential.resolveServiceEndpointCredential
// (no mock). Endpoint auth provided via ENDPOINT_AUTH_* / ENDPOINT_URL_* env vars.
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
process.env['AGENT_BUILDDIRECTORY'] = os.tmpdir();
const _saveNpmrcBase = path.join(os.tmpdir(), 'npmAuthenticate');
if (!fs.existsSync(_saveNpmrcBase)) {
    fs.mkdirSync(_saveNpmrcBase, { recursive: true });
}
process.env['SAVE_NPMRC_PATH'] = fs.mkdtempSync(_saveNpmrcBase + path.sep);
process.env['ENDPOINT_AUTH_PARAMETER_SYSTEMVSSCONNECTION_ACCESSTOKEN'] = TestConstants_1.TestData.systemAccessToken;
process.env['ENDPOINT_AUTH_SCHEME_SYSTEMVSSCONNECTION'] = 'OAuth';
// Set up real endpoint auth via env vars
const endpointId = process.env[TestConstants_1.TestEnvVars.customEndpoint] || '';
const extUrl = process.env[TestConstants_1.TestEnvVars.externalRegistryUrl] || '';
const extToken = process.env[TestConstants_1.TestEnvVars.externalRegistryToken] || '';
const endpointAuthScheme = process.env[TestConstants_1.TestEnvVars.endpointAuthScheme] || 'Token';
if (endpointId && extUrl) {
    process.env[`ENDPOINT_URL_${endpointId}`] = extUrl;
    if (endpointAuthScheme === 'Token') {
        process.env[`ENDPOINT_AUTH_${endpointId}`] = JSON.stringify({
            scheme: 'Token',
            parameters: { apitoken: extToken }
        });
    }
    else if (endpointAuthScheme === 'UsernamePassword') {
        process.env[`ENDPOINT_AUTH_${endpointId}`] = JSON.stringify({
            scheme: 'UsernamePassword',
            parameters: {
                username: process.env[TestConstants_1.TestEnvVars.endpointUsername] || 'testuser',
                password: process.env[TestConstants_1.TestEnvVars.endpointPassword] || 'testpass'
            }
        });
    }
}
tr.registerMock('azure-pipelines-tasks-packaging-common/locationUtilities', {
    getPackagingUris: function () {
        return __awaiter(this, void 0, void 0, function* () {
            return { PackagingUris: [TestConstants_1.TestData.collectionUri] };
        });
    },
    ProtocolType: { Npm: 1 }
});
tr.registerMock('azure-pipelines-tasks-artifacts-common/telemetry', {
    emitTelemetry: function (area, feature, data) {
        console.log(`${TestConstants_1.TestData.telemetryPrefix}${area}.${feature}:${JSON.stringify(data)}`);
    }
});
tr.registerMock('azure-pipelines-tasks-artifacts-common/EntraWifUserServiceConnectionUtils', {
    getFederatedWorkloadIdentityCredentialsForFeed: function () {
        return __awaiter(this, void 0, void 0, function* () { return undefined; });
    }
});
// Mock http/https for isEndpointInternal probe
const isInternalEndpoint = process.env[TestConstants_1.TestEnvVars.isInternalEndpoint] === 'true';
const httpProbeShouldFail = process.env[TestConstants_1.TestEnvVars.httpProbeShouldFail] === 'true';
const mockHttpModule = {
    get: function (_url, _options, callback) {
        if (httpProbeShouldFail) {
            return {
                on: function (event, handler) {
                    if (event === 'error') {
                        handler(new Error('Simulated network error'));
                    }
                }
            };
        }
        const mockResponse = {
            rawHeaders: isInternalEndpoint
                ? ['X-TFS-ServiceVersion', '3.0', 'X-VSS-E2EID', 'abc-123']
                : ['Content-Type', 'application/json'],
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
