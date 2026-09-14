import assert from 'assert';
import {
	validateRegistrySchemes,
	normalizeRegistry,
	toNerfDart,
	tryResolveFromEndpoints,
	tryResolveFromLocalRegistries
} from '../../npmauthutils';
import { NpmrcCredential } from '../../npmrcCredential';

describe('NpmAuthenticateV0 Unit - npmauthutils', function () {
	describe('validateRegistrySchemes', function () {
		for (const urls of [
			['https://registry.example/feed/', 'http://registry.example/feed/'],
			['http://registry.example/feed/', 'HTTPS://REGISTRY.EXAMPLE:443/feed/'],
			['https://registry.example/feed/', 'http://registry.example/other/'],
			['https://registry.example:8443/feed/', 'http://registry.example:8443/feed/']
		]) {
			it(`rejects mixed schemes: ${urls.join(', ')}`, function () {
				assert.throws(() => validateRegistrySchemes(urls), /mix HTTPS and non-HTTPS|Error_MixedRegistrySchemes/);
			});
		}

		it('allows different hosts, ports, and HTTPS-only aliases', function () {
			assert.doesNotThrow(() => validateRegistrySchemes([
				'https://registry.example/feed/', 'https://registry.example/other/',
				'http://other.example/feed/', 'http://registry.example:8080/feed/'
			]));
		});
	});

	describe('normalizeRegistry', function () {
		it('appends a trailing slash when missing', function () {
			const input = 'https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry';
			const normalized = normalizeRegistry(input);

			assert.strictEqual(normalized, `${input}/`);
		});

		it('keeps trailing slash when already present', function () {
			const input = 'https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/';
			const normalized = normalizeRegistry(input);

			assert.strictEqual(normalized, input);
		});
	});

	describe('toNerfDart', function () {
		it('converts registry url to nerf-dart format', function () {
			const registryUrl = 'https://pkgs.dev.azure.com/OrgName/_packaging/Feed/npm/registry/';
			const nerfed = toNerfDart(registryUrl);

			assert.strictEqual(nerfed, '//pkgs.dev.azure.com/OrgName/_packaging/Feed/npm/registry/');
		});

		it('normalizes host casing and ensures trailing slash', function () {
			const registryUrl = 'https://PKGS.DEV.AZURE.COM/org/_packaging/feed/npm/registry';
			const nerfed = toNerfDart(registryUrl);

			assert.strictEqual(nerfed, '//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/');
		});
	});

	describe('tryResolveFromEndpoints', function () {
		it('does not match an HTTPS endpoint to an HTTP registry', function () {
			const endpoint: NpmrcCredential = {
				url: 'https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/',
				auth: 'test-token'
			};

			assert.strictEqual(tryResolveFromEndpoints(
				'http://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/', [endpoint]
			), null);
		});

		it('returns matching endpoint credential', function () {
			const endpointRegistries: NpmrcCredential[] = [
				{
					url: 'https://pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/',
					auth: '//pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/:_authToken=tokenA'
				},
				{
					url: 'https://pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/',
					auth: '//pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/:_authToken=tokenB'
				}
			];

			const resolved = tryResolveFromEndpoints(
				'https://pkgs.dev.azure.com/org/_packaging/feedB/npm/registry',
				endpointRegistries
			);

			assert.strictEqual(resolved, endpointRegistries[1]);
		});

		it('returns null when no endpoint credential matches', function () {
			const endpointRegistries: NpmrcCredential[] = [
				{
					url: 'https://pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/',
					auth: '//pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/:_authToken=tokenA'
				}
			];

			const resolved = tryResolveFromEndpoints(
				'https://registry.npmjs.org/',
				endpointRegistries
			);

			assert.strictEqual(resolved, null);
		});
	});

	describe('tryResolveFromLocalRegistries', function () {
		it('does not match HTTPS local credentials to an HTTP registry', function () {
			const credential: NpmrcCredential = {
				url: 'https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/',
				auth: 'test-token'
			};

			assert.strictEqual(tryResolveFromLocalRegistries(
				'http://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/',
				[credential], [], 'pkgs.dev.azure.com'
			), null);
		});

		it('returns matching local credential', function () {
			const localRegistries: NpmrcCredential[] = [
				{
					url: 'https://pkgs.dev.azure.com/org/_packaging/internal/npm/registry/',
					auth: '//pkgs.dev.azure.com/org/_packaging/internal/npm/registry/:_authToken=internal'
				}
			];

			const resolved = tryResolveFromLocalRegistries(
				'https://pkgs.dev.azure.com/org/_packaging/internal/npm/registry',
				localRegistries,
				[],
				'pkgs.dev.azure.com'
			);

			assert.strictEqual(resolved, localRegistries[0]);
		});

		it('returns null when local registry does not match', function () {
			const localRegistries: NpmrcCredential[] = [
				{
					url: 'https://pkgs.dev.azure.com/org/_packaging/internal/npm/registry/',
					auth: '//pkgs.dev.azure.com/org/_packaging/internal/npm/registry/:_authToken=internal'
				}
			];

			const resolved = tryResolveFromLocalRegistries(
				'https://pkgs.dev.azure.com/org/_packaging/other/npm/registry/',
				localRegistries,
				[],
				'pkgs.dev.azure.com'
			);

			assert.strictEqual(resolved, null);
		});
	});
});
