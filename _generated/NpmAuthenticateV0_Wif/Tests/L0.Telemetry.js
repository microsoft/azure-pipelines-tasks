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
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const TestConstants_1 = require("./TestConstants");
const TestHelpers_1 = require("./TestHelpers");
describe('NpmAuthenticate L0 - Telemetry', function () {
    this.timeout(20000);
    beforeEach(function () {
        TestHelpers_1.TestHelpers.beforeEach();
    });
    afterEach(function () {
        TestHelpers_1.TestHelpers.afterEach();
    });
    it('emits telemetry on successful authentication', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange: internal feed that matches the collection URI host
        const internalUrl = `${TestConstants_1.TestData.collectionUri}_packaging/TestFeed/npm/registry/`;
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${internalUrl}`);
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath
        });
        // Assert
        TestHelpers_1.TestHelpers.assertSuccess(tr);
        TestHelpers_1.TestHelpers.assertOutputContains(tr, `${TestConstants_1.TestData.telemetryPrefix}Packaging.NpmAuthenticateV0`, 'Telemetry should be emitted to the Packaging area for NpmAuthenticateV0');
    }));
    it('emits telemetry even when the task fails', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange: point at a file without .npmrc extension — task fails early
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: path.join(os.tmpdir(), 'badfile.json')
        });
        // Assert
        TestHelpers_1.TestHelpers.assertFailure(tr);
        TestHelpers_1.TestHelpers.assertOutputContains(tr, `${TestConstants_1.TestData.telemetryPrefix}Packaging.NpmAuthenticateV0`, 'Telemetry should be emitted in the finally block even on task failure');
    }));
    it('records external feed auth count in telemetry', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange: one external service connection to authenticate
        const npmrcPath = TestHelpers_1.TestHelpers.createTempNpmrc(`registry=${TestConstants_1.TestData.externalRegistryUrl}`);
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: npmrcPath,
            [TestConstants_1.TestEnvVars.customEndpoint]: TestConstants_1.TestData.externalEndpointId,
            [TestConstants_1.TestEnvVars.externalRegistryUrl]: TestConstants_1.TestData.externalRegistryUrl,
            [TestConstants_1.TestEnvVars.externalRegistryToken]: TestConstants_1.TestData.externalRegistryToken
        });
        // Assert
        TestHelpers_1.TestHelpers.assertSuccess(tr);
        TestHelpers_1.TestHelpers.assertOutputContains(tr, '"ExternalFeedAuthCount":1');
    }));
});
