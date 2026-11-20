const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { test } = require('node:test');

for (const parallel of [true, false]) {
    test(`reports token refresh failure while polling ${parallel ? 'parallel' : 'serial'} builds`, () => {
        const script = `
            function mock(name, exports) {
                const filename = require.resolve('./dist/' + name);
                require.cache[filename] = { id: filename, filename, loaded: true, exports };
            }
            mock('api', { api: {
                tasks: ['TaskA'],
                getDefinition: async () => ({ variables: { ALLOW_PARALLEL_RUN: { value: '${parallel}' } } }),
                queueBuild: async () => ({ id: 123, _links: { web: { href: 'https://example.test/123' } } }),
                addBuildTags: async () => {}
            } });
            mock('helpers.Pipeline', { fetchPipelines: () => async () => [{ id: 133, name: 'TaskA' }] });
            mock('helpers', { getBuildConfigs: () => [''], getNodeVersionForTask: () => 24 });
            mock('helpers.Build', {
                fetchBuildStatus: async () => { throw new Error('token refresh failed'); },
                retryFailedJobsInBuild: async () => {}
            });
            global.setInterval = callback => { setImmediate(callback); return 1; };
            global.clearInterval = () => {};
            setTimeout(() => process.exit(2), 1000);
            require('./dist/index');
        `;
        const result = spawnSync(process.execPath, ['-e', script], {
            cwd: path.join(__dirname, '..'),
            encoding: 'utf8',
            timeout: 5000,
            env: { ...process.env, BUILD_SOURCEVERSION: 'test-commit' }
        });
        assert.ifError(result.error);
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stdout + result.stderr, /token refresh failed/);
        assert.match(result.stdout, /##vso\[task\.complete result=Failed\]/);
    });
}
