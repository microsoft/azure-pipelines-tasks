import assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as ini from 'ini';
import { mergeGlobalCredentials } from '../../npmGlobalConfig';
import { getRegistriesFromNpmrc, mergeNpmrcCredential, resolveInternalFeedCredentials } from '../../npmauthutils';

describe('NpmAuthenticateV0 Unit - shared credential merge', function () {
    const url = 'https://registry.example/feed/';
    const token = { url, auth: '//registry.example/feed/:_authToken=new-token' };

    for (const removeExisting of ['settingsReferencingRegistry', 'credentialsForExactRegistry'] as const) {
        it(`replaces multiline authentication and preserves unrelated registries with ${removeExisting}`, function () {
            const source = [
                `registry=${url}`,
                '//registry.example/feed/:username=old-user',
                '//registry.example/feed/:_password=old-password',
                '//registry.example/feed/:always-auth=true',
                '//other.example/:_authToken=keep-token'
            ];
            const original = [...source];
            const result = mergeNpmrcCredential(source, token, { removeExisting, removeComments: false });
            assert(result.replacedExistingCredentials);
            assert(!result.contents.includes('old-'));
            assert(result.contents.includes(source[0]));
            assert(result.contents.includes(source[4]));
            assert(result.contents.includes(token.auth));
            assert.deepStrictEqual(source, original, 'the pure merger must not mutate its input');
        });

        it(`replaces authentication added earlier with ${removeExisting}`, function () {
            const first = mergeNpmrcCredential([], {
                url,
                auth: '//registry.example/feed/:username=old\n//registry.example/feed/:_password=old'
            }, { removeExisting, removeComments: false });
            const second = mergeNpmrcCredential(first.lines, token, { removeExisting, removeComments: false });
            assert(second.replacedExistingCredentials);
            assert(!second.contents.includes('old'));
            assert.strictEqual(second.contents.split(token.auth).length - 1, 1);
        });
    }

    it('keeps legacy substring removal distinct from exact authentication matching', function () {
        const source = [
            '//registry.example/feed/child/:_authToken=child-token',
            '//registry.example/feed/:custom-setting=keep-setting',
            '//registry.example/other/:_authToken=other-token'
        ];
        const legacy = mergeNpmrcCredential(source, token, { removeExisting: 'settingsReferencingRegistry', removeComments: false });
        const scoped = mergeNpmrcCredential(source, token, { removeExisting: 'credentialsForExactRegistry', removeComments: false });
        assert(!legacy.contents.includes('child-token'));
        assert(!legacy.contents.includes('keep-setting'));
        assert(legacy.contents.includes('other-token'));
        for (const line of source) {
            assert(scoped.contents.includes(line));
        }
        assert(!scoped.replacedExistingCredentials);
    });

    it('matches normalized scopes without confusing ports, parent paths, or sibling paths', function () {
        const source = [
            '//REGISTRY.EXAMPLE:8443/feed:_authToken=replace-token',
            '//registry.example/feed/:_authToken=default-port-token',
            '//registry.example:8443/:_authToken=parent-token',
            '//registry.example:8443/feeds/:_authToken=sibling-token'
        ];
        const entry = {
            url: 'https://registry.example:8443/feed/',
            auth: '//registry.example:8443/feed/:_authToken=new-token'
        };
        const result = mergeNpmrcCredential(source, entry, { removeExisting: 'credentialsForExactRegistry', removeComments: false });
        assert(result.replacedExistingCredentials);
        assert(!result.contents.includes('replace-token'));
        for (const line of source.slice(1)) {
            assert(result.contents.includes(line));
        }
    });

    it('controls full-line comment removal independently of the existing-entry removal policy', function () {
        const source = ['# comment', ' ; commented-secret=value', 'proxy="https://proxy.example/#fragment"'];
        for (const removeExisting of ['settingsReferencingRegistry', 'credentialsForExactRegistry'] as const) {
            const kept = mergeNpmrcCredential(source, token, { removeExisting, removeComments: false });
            const removed = mergeNpmrcCredential(source, token, { removeExisting, removeComments: true });
            assert(kept.contents.includes('# comment'));
            assert(kept.contents.includes('commented-secret'));
            assert(!removed.contents.includes('# comment'));
            assert(!removed.contents.includes('commented-secret'));
            assert.strictEqual(ini.parse(removed.contents).proxy, 'https://proxy.example/#fragment');
        }
    });

    it('preserves legacy file bytes and grouped cached entries across successive merges', function () {
        const source = [`registry=${url}`, '//registry.example/feed/:_authToken=old-token'];
        const first = mergeNpmrcCredential(source, token, { removeExisting: 'settingsReferencingRegistry', removeComments: false });
        assert.strictEqual(first.contents, source[0] + os.EOL + os.EOL + token.auth + os.EOL);
        assert.deepStrictEqual(first.lines, [source[0], '', os.EOL + token.auth + os.EOL]);
        const latest = { url, auth: '//registry.example/feed/:_authToken=latest-token' };
        const second = mergeNpmrcCredential(first.lines, latest, { removeExisting: 'settingsReferencingRegistry', removeComments: false });
        assert.strictEqual(second.contents, source[0] + os.EOL + os.EOL + os.EOL + latest.auth + os.EOL);
    });
});

describe('NpmAuthenticateV0 Unit - global configuration', function () {
    const url = 'https://registry.example/feed/';
    const token = { url, auth: '//registry.example/feed/:_authToken=new-token' };

    it('preserves unrelated settings, placeholders, and other credentials but omits comments', function () {
        const source = [
            '# preserve this comment',
            '  ; commented-secret=do-not-copy',
            'proxy=${PROXY_URL}',
            '@other:registry=https://other.example/',
            '//other.example/:_authToken=other-token',
            '//registry.example/feed/child/:_authToken=child-token'
        ].join('\n');
        const result = mergeGlobalCredentials(source, [token]);
        for (const line of source.split('\n').filter(line => !/^\s*[#;]/.test(line))) {
            assert(result.includes(line));
        }
        assert(!result.includes('preserve this comment'));
        assert(!result.includes('commented-secret'));
        assert(result.includes(token.auth));
        assert(!result.includes(`registry=${url}`));
    });

    it('omits comments even when no credentials are added and preserves literal comment characters', function () {
        const source = '# secret\n ; another secret\nproxy="https://proxy.example/#fragment"\n';
        const result = mergeGlobalCredentials(source, []);
        assert(!result.includes('secret'));
        assert.strictEqual(ini.parse(result).proxy, 'https://proxy.example/#fragment');
    });

    it('replaces basic credentials and token aliases at the exact normalized scope', function () {
        const source = [
            '//REGISTRY.EXAMPLE/feed:username=old-user',
            '//registry.example/feed/:_password=old-password',
            '//registry.example/feed/:email=old-email',
            '//registry.example/feed/:_auth=old-basic',
            '//registry.example/feed/:_authToken=old-token',
            '//registry.example/other/:_authToken=keep-token'
        ].join('\n');
        const result = mergeGlobalCredentials(source, [token]);
        assert(!result.includes('old-'));
        assert(result.includes('keep-token'));
        assert(result.includes(token.auth));
    });

    it('accumulates registries and replaces a duplicate added earlier in the same merge', function () {
        const result = mergeGlobalCredentials('', [
            token,
            { url: 'https://other.example/', auth: '//other.example/:_authToken=other' },
            { url, auth: '//registry.example/feed/:_authToken=latest' }
        ]);
        assert(!result.includes('new-token'));
        assert(result.includes('_authToken=latest'));
        assert(result.includes('_authToken=other'));
    });

    it('replaces token authentication with username/password authentication', function () {
        const auth = '//registry.example/feed/:username=user\n'
            + '//registry.example/feed/:_password=cGFzcw==\n'
            + '//registry.example/feed/:always-auth=true';
        const result = ini.parse(mergeGlobalCredentials(token.auth, [{ url, auth }]));
        assert.strictEqual(result['//registry.example/feed/:_authToken'], undefined);
        assert.strictEqual(result['//registry.example/feed/:username'], 'user');
        assert.strictEqual(result['//registry.example/feed/:_password'], 'cGFzcw==');
    });

    it('replaces only the intended scope after adding multiline authentication', function () {
        const firstAuth = '//registry.example/feed/:username=old\n'
            + '//registry.example/feed/:_password=b2xk\n';
        const unrelated = '//other.example/:_authToken=other';
        const result = mergeGlobalCredentials('', [
            { url, auth: firstAuth },
            { url: 'https://other.example/', auth: unrelated },
            token
        ]);
        assert(!result.includes('username=old'));
        assert(!result.includes('_password='));
        assert(result.includes(unrelated));
        assert(result.includes(token.auth));
    });

    it('rejects INI sections instead of adding credentials inside a section', function () {
        assert.throws(() => mergeGlobalCredentials('[section]\nkey=value', [token]));
    });

    it('does not alter credential-free workingFile during global discovery', function () {
        const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'npm-global-unit-'));
        const file = path.join(directory, '.npmrc');
        const original = '# preserve bytes\r\n@team:registry=https://registry.example/feed\r\n';
        try {
            fs.writeFileSync(file, original);
            assert.deepStrictEqual(getRegistriesFromNpmrc(file, true), [url]);
            resolveInternalFeedCredentials(file, ['https://unrelated.example/'], true);
            assert.strictEqual(fs.readFileSync(file, 'utf8'), original);
            getRegistriesFromNpmrc(file);
            assert.notStrictEqual(fs.readFileSync(file, 'utf8'), original);
        } finally {
            fs.unlinkSync(file);
            fs.rmdirSync(directory);
        }
    });
});
