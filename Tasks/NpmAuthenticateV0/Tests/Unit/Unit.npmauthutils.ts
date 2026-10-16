import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
	validateAndFilterRegistryUrls,
	normalizeRegistry,
	toNerfDart,
	tryResolveFromEndpoints,
	tryResolveFromLocalRegistries,
	initializeBackupDirectory
} from '../../npmauthutils';
import { NpmrcCredential } from '../../npmrcCredential';

describe('NpmAuthenticateV0 Unit - npmauthutils', function () {
	describe('validateAndFilterRegistryUrls', function () {
		for (const urls of [
			['https://registry.example/feed/', 'http://registry.example/feed/'],
			['http://registry.example/feed/', 'HTTPS://REGISTRY.EXAMPLE:443/feed/'],
			['https://registry.example/feed/', 'http://registry.example/other/'],
			['https://registry.example:8443/feed/', 'http://registry.example:8443/feed/']
		]) {
			it(`rejects mixed schemes: ${urls.join(', ')}`, function () {
				assert.throws(() => validateAndFilterRegistryUrls(urls), /mix HTTPS and non-HTTPS|Error_MixedRegistrySchemes/);
			});
		}

		it('allows different hosts, ports, and HTTPS-only aliases', function () {
			assert.doesNotThrow(() => validateAndFilterRegistryUrls([
				'https://registry.example/feed/', 'https://registry.example/other/',
				'http://other.example/feed/', 'http://registry.example:8080/feed/'
			]));
		});

		it('filters malformed registry URLs', function () {
			assert.deepStrictEqual(validateAndFilterRegistryUrls([
				'not-a-url', 'https://registry.example/feed/'
			]), ['https://registry.example/feed/']);
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

	describe('initializeBackupDirectory', function () {
		const savedEnv: { [key: string]: string } = {};
		const envKeys = ['SAVE_NPMRC_PATH', 'NPM_AUTHENTICATE_TEMP_DIRECTORY', 'AGENT_HOMEDIRECTORY', 'AGENT_TEMPDIRECTORY'];
		let scratchRoot: string;

		beforeEach(function () {
			for (const key of envKeys) {
				savedEnv[key] = process.env[key];
				delete process.env[key];
			}
			scratchRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'npmauthutils-test-'));
		});

		afterEach(function () {
			for (const key of envKeys) {
				if (savedEnv[key] === undefined) {
					delete process.env[key];
				} else {
					process.env[key] = savedEnv[key];
				}
			}
			fs.rmSync(scratchRoot, { recursive: true, force: true });
		});

		it('prefers Agent.HomeDirectory when it is writable', function () {
			const homeDirectory = path.join(scratchRoot, 'home');
			fs.mkdirSync(homeDirectory);
			process.env['AGENT_HOMEDIRECTORY'] = homeDirectory;
			process.env['AGENT_TEMPDIRECTORY'] = path.join(scratchRoot, 'temp');

			const backupDirectory = initializeBackupDirectory();

			assert.ok(backupDirectory.startsWith(path.join(homeDirectory, 'npmAuthenticateBackup')));
			assert.ok(fs.existsSync(backupDirectory));
		});

		it('falls back to Agent.TempDirectory when Agent.HomeDirectory is not writable', function () {
			const homeDirectory = path.join(scratchRoot, 'home');
			fs.mkdirSync(homeDirectory);
			// Pre-create a regular file where the task needs to create a directory, so
			// tl.mkdirP() reliably fails regardless of platform/permission semantics.
			fs.writeFileSync(path.join(homeDirectory, 'npmAuthenticateBackup'), 'not a directory');
			const tempDirectory = path.join(scratchRoot, 'temp');
			fs.mkdirSync(tempDirectory);
			process.env['AGENT_HOMEDIRECTORY'] = homeDirectory;
			process.env['AGENT_TEMPDIRECTORY'] = tempDirectory;

			const backupDirectory = initializeBackupDirectory();

			assert.ok(backupDirectory.startsWith(path.join(tempDirectory, 'npmAuthenticateBackup')));
			assert.ok(fs.existsSync(backupDirectory));
		});

		it('throws when neither Agent.HomeDirectory nor Agent.TempDirectory is usable', function () {
			const homeDirectory = path.join(scratchRoot, 'home');
			fs.mkdirSync(homeDirectory);
			fs.writeFileSync(path.join(homeDirectory, 'npmAuthenticateBackup'), 'not a directory');
			process.env['AGENT_HOMEDIRECTORY'] = homeDirectory;
			// No AGENT_TEMPDIRECTORY set.

			assert.throws(() => initializeBackupDirectory());
		});
	});
});
