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
describe('NpmAuthenticate L0 - Input Validation', function () {
    this.timeout(20000);
    beforeEach(function () {
        TestHelpers_1.TestHelpers.beforeEach();
    });
    afterEach(function () {
        TestHelpers_1.TestHelpers.afterEach();
    });
    it('fails when workingFile does not have an .npmrc extension', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange: point workingFile at a non-.npmrc file path
        const notNpmrc = path.join(os.tmpdir(), 'package.json');
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: notNpmrc
        });
        // Assert: task must fail because the extension check fires before any file I/O
        TestHelpers_1.TestHelpers.assertFailure(tr, 'Task should fail when workingFile does not end in .npmrc');
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'NpmrcNotNpmrc');
    }));
    it('fails when the .npmrc file does not exist on disk', () => __awaiter(this, void 0, void 0, function* () {
        // Arrange: valid .npmrc extension but file is not present
        const missingFile = path.join(os.tmpdir(), 'does-not-exist.npmrc');
        // Act
        const tr = yield TestHelpers_1.TestHelpers.runTestWithEnv({
            [TestConstants_1.TestEnvVars.npmrcPath]: missingFile,
            [TestConstants_1.TestEnvVars.npmrcShouldExist]: 'false'
        });
        // Assert
        TestHelpers_1.TestHelpers.assertFailure(tr, 'Task should fail when the .npmrc file is missing');
        TestHelpers_1.TestHelpers.assertOutputContains(tr, 'NpmrcDoesNotExist');
    }));
});
