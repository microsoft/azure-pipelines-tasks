const assert = require('node:assert/strict');
const { test } = require('node:test');
const childProcess = require('node:child_process');
const { getServiceConnectionHandler } = require('../dist/auth');

function token(exp) {
    return `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
}

test('uses bearer authentication without invoking Azure CLI while the token is valid', () => {
    const accessToken = token(Math.floor(Date.now() / 1000) + 3600);
    const handler = getServiceConnectionHandler(accessToken);
    const request = { headers: {} };
    handler.prepareRequest(request);
    assert.equal(request.headers.Authorization, `Bearer ${accessToken}`);
});

test('refreshes an expiring token and reuses it for subsequent requests', () => {
    const originalExec = childProcess.execFileSync;
    const originalLog = console.log;
    const refreshedToken = token(Math.floor(Date.now() / 1000) + 3600);
    const logs = [];
    let refreshes = 0;
    childProcess.execFileSync = (command, args) => {
        assert.equal(command, 'az');
        assert.ok(args.includes('499b84ac-1321-427f-aa17-267ca6975798'));
        refreshes++;
        return refreshedToken + '\n';
    };
    console.log = message => logs.push(message);
    try {
        const handler = getServiceConnectionHandler(token(Math.floor(Date.now() / 1000) + 60));
        for (let i = 0; i < 2; i++) {
            const request = { headers: {} };
            handler.prepareRequest(request);
            assert.equal(request.headers.Authorization, `Bearer ${refreshedToken}`);
        }
        assert.equal(refreshes, 1);
        assert.deepEqual(logs, [`##vso[task.setsecret]${refreshedToken}`]);
    } finally {
        childProcess.execFileSync = originalExec;
        console.log = originalLog;
    }
});

test('never forwards bearer tokens on cross-origin redirects, including after refresh', () => {
    const originalExec = childProcess.execFileSync;
    const originalLog = console.log;
    const originalNow = Date.now;
    const initialTime = Date.now();
    const accessToken = token(Math.floor(initialTime / 1000) + 3600);
    const refreshedToken = token(Math.floor(initialTime / 1000) + 7200);
    childProcess.execFileSync = () => refreshedToken;
    console.log = () => {};
    try {
        const handler = getServiceConnectionHandler(accessToken);
        const request = host => {
            const options = { host, headers: {} };
            handler.prepareRequest(options);
            return options.headers.Authorization;
        };
        assert.equal(request('dev.azure.com'), `Bearer ${accessToken}`);
        assert.equal(request('elsewhere.example'), undefined);
        Date.now = () => initialTime + 56 * 60 * 1000;
        assert.equal(request('dev.azure.com'), `Bearer ${refreshedToken}`);
        assert.equal(request('elsewhere.example'), undefined);
    } finally {
        childProcess.execFileSync = originalExec;
        console.log = originalLog;
        Date.now = originalNow;
    }
});

test('fails explicitly when the service connection token is missing or invalid', () => {
    assert.throws(() => getServiceConnectionHandler(''), /token is not provided/);
    assert.throws(() => getServiceConnectionHandler('invalid'), /Invalid service connection token/);
});

test('does not continue with an expired token when refresh fails', () => {
    const originalExec = childProcess.execFileSync;
    childProcess.execFileSync = () => { throw new Error('Azure CLI token acquisition failed'); };
    try {
        const handler = getServiceConnectionHandler(token(Math.floor(Date.now() / 1000) - 60));
        assert.throws(() => handler.prepareRequest({ headers: {} }), /Azure CLI token acquisition failed/);
    } finally {
        childProcess.execFileSync = originalExec;
    }
});

test('wires the environment token and token-free arguments into queueing and polling', async () => {
    const sdk = require('azure-devops-node-api');
    const originalWebApi = sdk.WebApi;
    const originalArgv = process.argv;
    const originalToken = process.env.CANARY_BUILDS_ACCESS_TOKEN;
    const accessToken = token(Math.floor(Date.now() / 1000) + 3600);
    const requests = [];
    sdk.WebApi = class {
        constructor(url, handler) {
            assert.equal(url, 'https://dev.azure.com/canarytest');
            this.handler = handler;
        }
        async getBuildApi() {
            const request = (method, ...args) => {
                const options = { host: 'dev.azure.com', headers: {} };
                this.handler.prepareRequest(options);
                assert.equal(options.headers.Authorization, `Bearer ${accessToken}`);
                requests.push([method, ...args]);
            };
            return {
                queueBuild: (...args) => request('queueBuild', ...args),
                getBuild: (...args) => request('getBuild', ...args),
                updateBuild: (...args) => request('updateBuild', ...args)
            };
        }
    };
    process.argv = ['node', 'runner', 'https://dev.azure.com/canarytest', 'PipelineTasks', 'TaskA,TaskB'];
    process.env.CANARY_BUILDS_ACCESS_TOKEN = accessToken;
    try {
        const { api } = require('../dist/api');
        assert.deepEqual(api.tasks, ['TaskA', 'TaskB']);
        await api.queueBuild(133, { CANARY_TEST_TASKNAME: 'TaskA' });
        await api.getBuild(123);
        await api.updateBuild(123);
        assert.deepEqual(requests, [
            ['queueBuild', { definition: { id: 133 }, parameters: '{"CANARY_TEST_TASKNAME":"TaskA"}' }, 'PipelineTasks'],
            ['getBuild', 'PipelineTasks', 123],
            ['updateBuild', {}, 'PipelineTasks', 123, true]
        ]);
    } finally {
        sdk.WebApi = originalWebApi;
        process.argv = originalArgv;
        if (originalToken === undefined) {
            delete process.env.CANARY_BUILDS_ACCESS_TOKEN;
        } else {
            process.env.CANARY_BUILDS_ACCESS_TOKEN = originalToken;
        }
        delete require.cache[require.resolve('../dist/api')];
    }
});
