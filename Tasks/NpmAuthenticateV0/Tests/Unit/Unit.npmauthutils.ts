import assert from 'assert';
import {
	normalizeRegistry,
	toNerfDart,
	tryResolveFromEndpoints,
	tryResolveFromLocalRegistries
} from '../../npmauthutils';
import { NpmrcCredential } from '../../npmrcCredential';

describe('NpmAuthenticateV0 Unit - npmauthutils', function () {
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
