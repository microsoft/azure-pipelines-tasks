import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as URL from 'url';
import {
	appendAuthToNpmrc,
	normalizeRegistry,
	removeExistingCredentialEntries,
	toNerfDart,
	tryResolveFromEndpoints,
	tryResolveFromLocalRegistries,
	NpmrcCredential
} from '../../npmauthutils';

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
					auth: '//pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/:_authToken=tokenA',
					authOnly: true
				},
				{
					url: 'https://pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/',
					auth: '//pkgs.dev.azure.com/org/_packaging/feedB/npm/registry/:_authToken=tokenB',
					authOnly: true
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
					auth: '//pkgs.dev.azure.com/org/_packaging/feedA/npm/registry/:_authToken=tokenA',
					authOnly: true
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
					auth: '//pkgs.dev.azure.com/org/_packaging/internal/npm/registry/:_authToken=internal',
					authOnly: true
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
					auth: '//pkgs.dev.azure.com/org/_packaging/internal/npm/registry/:_authToken=internal',
					authOnly: true
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

	describe('npmrc file mutations', function () {
		it('appends auth entry to npmrc file', function () {
			const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-unit-'));
			try {
				const npmrcPath = path.join(tempDir, '.npmrc');
				fs.writeFileSync(npmrcPath, 'registry=https://registry.npmjs.org/\n', 'utf8');

				appendAuthToNpmrc(npmrcPath, '//registry.npmjs.org/:_authToken=test-token');

				const content = fs.readFileSync(npmrcPath, 'utf8');
				assert(content.includes('//registry.npmjs.org/:_authToken=test-token'));
			} finally {
				fs.rmSync(tempDir, { recursive: true, force: true });
			}
		});

		it('removes pre-existing credential lines for the same registry', function () {
			const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauth-unit-'));
			try {
				const npmrcPath = path.join(tempDir, '.npmrc');
				const registryUrl = URL.parse('https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/');
				const lines = [
					'registry=https://pkgs.dev.azure.com/org/_packaging/feed/npm/registry/',
					'//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/:_authToken=old-token',
					'//pkgs.dev.azure.com/org/_packaging/feed/npm/registry/:always-auth=true'
				];

				fs.writeFileSync(npmrcPath, lines.join(os.EOL), 'utf8');

				const updated = removeExistingCredentialEntries(
					npmrcPath,
					[...lines],
					registryUrl,
					[registryUrl]
				);

				assert.strictEqual(updated[0], lines[0]);
				assert.strictEqual(updated[1], '');
				assert.strictEqual(updated[2], '');

				const fileContent = fs.readFileSync(npmrcPath, 'utf8');
				assert(!fileContent.includes('_authToken=old-token'));
				assert(!fileContent.includes('always-auth=true'));
			} finally {
				fs.rmSync(tempDir, { recursive: true, force: true });
			}
		});
	});
});
