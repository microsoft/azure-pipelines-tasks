"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert_1 = __importDefault(require("assert"));
const fs_1 = __importDefault(require("fs"));
const os_1 = __importDefault(require("os"));
const path_1 = __importDefault(require("path"));
const npmauthutils_1 = require("../../npmauthutils");
describe('NpmAuthenticateV0 Unit - npmauthutils', function () {
    describe('validateAndFilterRegistryUrls', function () {
        for (const urls of [
            ['https://registry.example/feed/', 'http://registry.example/feed/'],
            ['http://registry.example/feed/', 'HTTPS://REGISTRY.EXAMPLE:443/feed/'],
            ['https://registry.example/feed/', 'http://registry.example/other/'],
            ['https://registry.example:8443/feed/', 'http://registry.example:8443/feed/']
        ]) {
            it(`rejects mixed schemes: ${urls.join(', ')}`, function () {
                assert_1.default.throws(() => (0, npmauthutils_1.validateAndFilterRegistryUrls)(urls), /mix HTTPS and non-HTTPS|Error_MixedRegistrySchemes/);
            });
        }
        it('allows different hosts, ports, and HTTPS-only aliases', function () {
            assert_1.default.doesNotThrow(() => (0, npmauthutils_1.validateAndFilterRegistryUrls)([
                'https://registry.example/feed/', 'https://registry.example/other/',
                'http://other.example/feed/', 'http://registry.example:8080/feed/'
            ]));
        });
        it('filters malformed registry URLs', function () {
            assert_1.default.deepStrictEqual((0, npmauthutils_1.validateAndFilterRegistryUrls)([
                'not-a-url', 'https://registry.example/feed/'
            ]), ['https://registry.example/feed/']);
        });
    });
    describe('normalizeRegistry', function () {
        it('appends a trailing slash when missing', function () {
            const input = 'https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry';
            const normalized = (0, npmauthutils_1.normalizeRegistry)(input);
            assert_1.default.strictEqual(normalized, `${input}/`);
        });
        it('keeps trailing slash when already present', function () {
            const input = 'https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/';
            const normalized = (0, npmauthutils_1.normalizeRegistry)(input);
            assert_1.default.strictEqual(normalized, input);
        });
    });
    describe('toNerfDart', function () {
        it('converts registry url to nerf-dart format', function () {
            const registryUrl = 'https://pkgs.dev.azure.com/OrgName/_packaging/Feed/npm/registry/';
            const nerfed = (0, npmauthutils_1.toNerfDart)(registryUrl);
            assert_1.default.strictEqual(nerfed, '//pkgs.dev.azure.com/OrgName/_packaging/Feed/npm/registry/');
        });
        describe('resolveInternalFeedCredentials', function () {
            it('does not create System.AccessToken credentials for HTTP packaging origins', function () {
                const tempDir = fs_1.default.mkdtempSync(path_1.default.join(os_1.default.tmpdir(), 'npm-auth-http-origin-'));
                const npmrc = path_1.default.join(tempDir, '.npmrc');
                const registry = 'http://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/';
                fs_1.default.writeFileSync(npmrc, `registry=${registry}`);
                try {
                    assert_1.default.deepStrictEqual((0, npmauthutils_1.resolveInternalFeedCredentials)(npmrc, [registry]), []);
                }
                finally {
                    fs_1.default.rmSync(tempDir, { recursive: true, force: true });
                }
            });
        });
        it('normalizes host casing and ensures trailing slash', function () {
            const registryUrl = 'https://PKGS.DEV.AZURE.COM/org/_packaging/feed/npm/registry';
            const nerfed = (0, npmauthutils_1.toNerfDart)(registryUrl);
            assert_1.default.strictEqual(nerfed, '//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/');
        });
    });
    describe('tryResolveFromEndpoints', function () {
        it('does not match an HTTPS endpoint to an HTTP registry', function () {
            const endpoint = {
                url: 'https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/',
                auth: 'test-token'
            };
            assert_1.default.strictEqual((0, npmauthutils_1.tryResolveFromEndpoints)('http://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/', [endpoint]), null);
        });
        it('returns matching endpoint credential', function () {
            const endpointRegistries = [
                {
                    url: 'https://pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/',
                    auth: '//pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/:_authToken=tokenA'
                },
                {
                    url: 'https://pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/',
                    auth: '//pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/:_authToken=tokenB'
                }
            ];
            const resolved = (0, npmauthutils_1.tryResolveFromEndpoints)('https://pkgs.dev.azure.com/org/_packaging/feedB/npm/registry', endpointRegistries);
            assert_1.default.strictEqual(resolved, endpointRegistries[1]);
        });
        it('returns null when no endpoint credential matches', function () {
            const endpointRegistries = [
                {
                    url: 'https://pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/',
                    auth: '//pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/:_authToken=tokenA'
                }
            ];
            const resolved = (0, npmauthutils_1.tryResolveFromEndpoints)('https://registry.npmjs.org/', endpointRegistries);
            assert_1.default.strictEqual(resolved, null);
        });
    });
    describe('tryResolveFromLocalRegistries', function () {
        it('does not match HTTPS local credentials to an HTTP registry', function () {
            const credential = {
                url: 'https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/',
                auth: 'test-token'
            };
            assert_1.default.strictEqual((0, npmauthutils_1.tryResolveFromLocalRegistries)('http://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/', [credential], [], 'pkgs.dev.azure.com'), null);
        });
        it('returns matching local credential', function () {
            const localRegistries = [
                {
                    url: 'https://pkgs.dev.azure.com/org/_packaging/internal/npm/registry/',
                    auth: '//pkgs.dev.azure.com/org/_packaging/internal/npm/registry/:_authToken=internal'
                }
            ];
            const resolved = (0, npmauthutils_1.tryResolveFromLocalRegistries)('https://pkgs.dev.azure.com/org/_packaging/internal/npm/registry', localRegistries, [], 'pkgs.dev.azure.com');
            assert_1.default.strictEqual(resolved, localRegistries[0]);
        });
        it('returns null when local registry does not match', function () {
            const localRegistries = [
                {
                    url: 'https://pkgs.dev.azure.com/org/_packaging/internal/npm/registry/',
                    auth: '//pkgs.dev.azure.com/org/_packaging/internal/npm/registry/:_authToken=internal'
                }
            ];
            const resolved = (0, npmauthutils_1.tryResolveFromLocalRegistries)('https://pkgs.dev.azure.com/org/_packaging/other/npm/registry/', localRegistries, [], 'pkgs.dev.azure.com');
            assert_1.default.strictEqual(resolved, null);
        });
    });
});
