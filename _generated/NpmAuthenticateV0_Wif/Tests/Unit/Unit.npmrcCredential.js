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
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const npmrcCredential_1 = require("../../npmrcCredential");
const npmauthutils_1 = require("../../npmauthutils");
describe('NpmAuthenticateV0 Unit - npmrcCredential', function () {
    const originalGetEndpointAuthorization = tl.getEndpointAuthorization;
    const originalGetEndpointUrl = tl.getEndpointUrl;
    const endpointId = 'UnitEndpoint';
    before(function () {
        tl.setResourcePath(path.join(__dirname, '..', '..', 'task.json'));
    });
    afterEach(function () {
        tl.getEndpointAuthorization = originalGetEndpointAuthorization;
        tl.getEndpointUrl = originalGetEndpointUrl;
    });
    it('throws when endpoint auth is missing', () => __awaiter(this, void 0, void 0, function* () {
        tl.getEndpointAuthorization = () => {
            throw new Error('missing auth');
        };
        tl.getEndpointUrl = () => 'https://registry.example.com/npm';
        try {
            yield (0, npmrcCredential_1.resolveServiceEndpointCredential)(endpointId, npmauthutils_1.normalizeRegistry, npmauthutils_1.toNerfDart);
            assert_1.default.fail('Expected resolveServiceEndpointCredential to throw');
        }
        catch (error) {
            (0, assert_1.default)(String(error).includes('service connection'), `Expected error about service connection, got: ${error}`);
        }
    }));
    it('throws when endpoint url is missing', () => __awaiter(this, void 0, void 0, function* () {
        tl.getEndpointAuthorization = () => ({
            scheme: 'UsernamePassword',
            parameters: { username: 'u', password: 'p' }
        });
        tl.getEndpointUrl = () => {
            throw new Error('missing url');
        };
        try {
            yield (0, npmrcCredential_1.resolveServiceEndpointCredential)(endpointId, npmauthutils_1.normalizeRegistry, npmauthutils_1.toNerfDart);
            assert_1.default.fail('Expected resolveServiceEndpointCredential to throw');
        }
        catch (error) {
            (0, assert_1.default)(String(error).includes('URL for the service connection'), `Expected error about service connection URL, got: ${error}`);
        }
    }));
    it('throws for unsupported auth scheme', () => __awaiter(this, void 0, void 0, function* () {
        tl.getEndpointAuthorization = () => ({
            scheme: 'Certificate',
            parameters: {}
        });
        tl.getEndpointUrl = () => 'https://registry.example.com/npm';
        try {
            yield (0, npmrcCredential_1.resolveServiceEndpointCredential)(endpointId, npmauthutils_1.normalizeRegistry, npmauthutils_1.toNerfDart);
            assert_1.default.fail('Expected resolveServiceEndpointCredential to throw');
        }
        catch (error) {
            (0, assert_1.default)(String(error).includes('Unsupported auth scheme'));
        }
    }));
    it('formats UsernamePassword credentials as basic auth lines', () => __awaiter(this, void 0, void 0, function* () {
        tl.getEndpointAuthorization = () => ({
            scheme: 'UsernamePassword',
            parameters: {
                username: 'myuser',
                password: 'mypassword'
            }
        });
        tl.getEndpointUrl = () => 'https://registry.example.com/npm';
        const credential = yield (0, npmrcCredential_1.resolveServiceEndpointCredential)(endpointId, npmauthutils_1.normalizeRegistry, npmauthutils_1.toNerfDart);
        assert_1.default.strictEqual(credential.url, 'https://registry.example.com/npm/');
        (0, assert_1.default)(credential.auth.includes('username=myuser'));
        (0, assert_1.default)(credential.auth.includes(':_password='));
        (0, assert_1.default)(credential.auth.includes('email=myuser'));
        (0, assert_1.default)(credential.auth.includes('always-auth=true'));
    }));
});
