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
exports.resolveServiceEndpointCredential = resolveServiceEndpointCredential;
const os = __importStar(require("os"));
const tl = __importStar(require("azure-pipelines-task-lib/task"));
const https_proxy_agent_1 = __importDefault(require("https-proxy-agent"));
function resolveServiceEndpointCredential(endpointId, normalizeRegistry, toNerfDart) {
    return __awaiter(this, void 0, void 0, function* () {
        const endpointAuth = getEndpointAuth(endpointId);
        const endpointUrl = getEndpointUrl(endpointId, normalizeRegistry);
        const nerfed = toNerfDart(endpointUrl);
        // For Token auth, probe whether this is an Azure DevOps registry (basic auth)
        // or an external registry (bearer token).
        const isInternalEndpoint = endpointAuth.scheme === 'Token'
            ? yield isEndpointInternal(endpointUrl)
            : false;
        const credentials = buildEndpointCredentials(endpointAuth, isInternalEndpoint);
        const auth = formatNpmrcAuthLines(nerfed, credentials);
        if (credentials.password) {
            tl.setSecret(credentials.password);
        }
        return { url: endpointUrl, auth };
    });
}
function getEndpointAuth(endpointId) {
    try {
        return tl.getEndpointAuthorization(endpointId, false);
    }
    catch (_a) {
        throw new Error(tl.loc('ServiceEndpointNotDefined'));
    }
}
function getEndpointUrl(endpointId, normalizeRegistry) {
    try {
        return normalizeRegistry(tl.getEndpointUrl(endpointId, false));
    }
    catch (_a) {
        throw new Error(tl.loc('ServiceEndpointUrlNotDefined'));
    }
}
// ADO npm registries don't support Bearer PATs, so Token auth gets re-encoded as basic auth
function buildEndpointCredentials(endpointAuth, isInternalEndpoint) {
    switch (endpointAuth.scheme) {
        case 'UsernamePassword': {
            const username = endpointAuth.parameters['username'];
            const password = endpointAuth.parameters['password'];
            return { username, password, email: username };
        }
        case 'Token': {
            const apitoken = endpointAuth.parameters['apitoken'];
            tl.setSecret(apitoken);
            if (!isInternalEndpoint) {
                return { username: '', password: apitoken, email: '' };
            }
            return { username: 'VssToken', password: apitoken, email: 'VssEmail' };
        }
        default:
            throw new Error(tl.loc('Error_UnsupportedAuthScheme', endpointAuth.scheme));
    }
}
function formatNpmrcAuthLines(nerfed, credentials) {
    const lineEnd = os.EOL;
    // Bearer-style (external token)
    if (!credentials.username && credentials.password) {
        return `${nerfed}:_authToken=${credentials.password}${lineEnd}`
            + `${nerfed}:always-auth=true`;
    }
    // Basic-style (username + base64 password)
    const password64 = Buffer.from(credentials.password).toString('base64');
    tl.setSecret(password64);
    return `${nerfed}:username=${credentials.username}${lineEnd}`
        + `${nerfed}:_password=${password64}${lineEnd}`
        + `${nerfed}:email=${credentials.email}${lineEnd}`
        + `${nerfed}:always-auth=true`;
}
// Probes the endpoint with an HTTP GET to check for x-tfs/x-vss response
// headers, which indicate an Azure DevOps service.
function isEndpointInternal(endpointUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        const httpModule = endpointUrl.startsWith('https') ? yield Promise.resolve().then(() => __importStar(require('https'))) : yield Promise.resolve().then(() => __importStar(require('http')));
        const TIMEOUT_MS = 10000;
        return new Promise((resolve) => {
            const options = {
                headers: { 'X-TFS-FedAuthRedirect': 'Suppress' },
                timeout: TIMEOUT_MS
            };
            const proxy = tl.getHttpProxyConfiguration();
            if (proxy) {
                options.agent = (0, https_proxy_agent_1.default)(proxy.proxyUrl);
            }
            const req = httpModule.get(endpointUrl, options, (resp) => {
                resp.resume();
                const rawHeaders = resp.rawHeaders || [];
                const isInternal = rawHeaders.some(h => h.toLowerCase().includes('x-tfs') || h.toLowerCase().includes('x-vss'));
                resolve(isInternal);
            });
            req.on('timeout', () => {
                tl.debug(tl.loc('Error_EndpointProbeTimeout', TIMEOUT_MS));
                req.destroy();
                resolve(false);
            });
            req.on('error', (error) => {
                tl.debug(tl.loc('Error_EndpointProbeFailed', error));
                resolve(false);
            });
        });
    });
}
