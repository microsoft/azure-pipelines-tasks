import * as assert from 'assert';
import * as path from 'path';
import * as mocker from 'azure-pipelines-task-lib/lib-mocker';
import * as tl from 'azure-pipelines-task-lib/task';

const mode = process.argv[2];
const enabled = mode !== 'false' && mode !== 'unset';
const hasDatabase = mode !== 'no-database';
const featureVariable = 'DISTRIBUTEDTASK_TASKS_ENABLEPUBLISHPROFILELOGREDACTION';
if (mode === 'unset') {
    delete process.env[featureVariable];
} else {
    process.env[featureVariable] = enabled ? 'true' : 'false';
}

const safe = {
    WebPublishMethod: ['MSDeploy'],
    MSDeployServiceURL: ['localhost'],
    DeployIisAppPath: ['demoapp'],
    UserName: ['demoapp']
};
const database = { ObjectGroup: [{ Destination: [{ $: { Path: 'Password=DbPoC7' } }] }] };
const profile = {
    ...safe,
    UserPWD: ['FakePublishPassword'],
    OtherSecret: ['FakeFutureSecret'],
    ...(hasDatabase ? { PublishDatabaseSettings: [database] } : {})
};
const xml = `<Project><PropertyGroup>
    <WebPublishMethod>MSDeploy</WebPublishMethod>
    <MSDeployServiceURL>localhost</MSDeployServiceURL>
    <DeployIisAppPath>demoapp</DeployIisAppPath>
    <UserName>demoapp</UserName>
    <UserPWD>FakePublishPassword</UserPWD>
    <OtherSecret>FakeFutureSecret</OtherSecret>
    ${hasDatabase ? '<PublishDatabaseSettings><ObjectGroup><Destination Path="Password=DbPoC7" /></ObjectGroup></PublishDatabaseSettings>' : ''}
</PropertyGroup></Project>`;
const diagnostics: string[] = [];
const telemetry: string[] = [];
const parseString = require('xml2js').parseString;

mocker.enable({ warnOnUnregistered: false });
mocker.registerMock('azure-pipelines-task-lib/task', {
    ...tl,
    debug: (message: string) => diagnostics.push(message)
});
mocker.registerMock('azure-pipelines-tasks-webdeployment-common/packageUtility.js', {
    PackageUtility: {
        getPackagePath: (file: string) => {
            assert.strictEqual(file, 'test.pubxml');
            return file;
        }
    }
});
mocker.registerMock('fs', {
    readFileSync: (file: string) => {
        assert.strictEqual(file, 'test.pubxml');
        return Buffer.from(xml);
    }
});
mocker.registerMock('xml2js', { parseString });

async function run(): Promise<void> {
    const { PublishProfileUtility, getRedactedPublishProfileForLog } = await import('../operations/PublishProfileUtility');
    const snapshot = JSON.stringify(profile);
    const redacted = getRedactedPublishProfileForLog(profile);
    assert.deepStrictEqual(redacted, {
        safe,
        droppedFieldCount: hasDatabase ? 3 : 2,
        hasNestedDbSettings: hasDatabase
    });
    assert.strictEqual(JSON.stringify(profile), snapshot, 'Redaction must not mutate the deployment profile');
    assert.deepStrictEqual(getRedactedPublishProfileForLog({}), {
        safe: {}, droppedFieldCount: 0, hasNestedDbSettings: false
    });

    const originalLog = console.log;
    console.log = (message: string) => {
        if (mode === 'telemetry-failure') {
            throw new Error('test telemetry unavailable');
        }
        telemetry.push(message);
    };
    try {
        const utility = new PublishProfileUtility('test.pubxml');
        assert.strictEqual(await utility.GetPropertyValuefromPublishProfile('UserPWD'), 'FakePublishPassword');
        assert.strictEqual(await utility.GetPropertyValuefromPublishProfile('OtherSecret'), 'FakeFutureSecret');
        if (hasDatabase) {
            assert.deepStrictEqual(await utility.GetPropertyValuefromPublishProfile('PublishDatabaseSettings'), database);
        }
    } finally {
        console.log = originalLog;
    }

    const profileLogs = diagnostics.filter(message => message.startsWith('Publish Profile: '));
    assert.deepStrictEqual(profileLogs, ['Publish Profile: ' + JSON.stringify(enabled ? safe : profile)]);
    if (enabled) {
        for (const secret of ['DbPoC7', 'FakePublishPassword', 'FakeFutureSecret']) {
            assert.strictEqual(diagnostics.join('\n').indexOf(secret), -1);
            assert.strictEqual(telemetry.join('\n').indexOf(secret), -1);
        }
    }
    if (enabled && mode !== 'telemetry-failure') {
        assert.deepStrictEqual(telemetry, [
            `##vso[telemetry.publish area=TaskHub;feature=${path.basename(path.dirname(__dirname))}]`
            + JSON.stringify({
                event: 'PublishProfileLogRedacted',
                droppedFieldCount: hasDatabase ? 3 : 2,
                hasNestedDbSettings: hasDatabase
            })
        ]);
    } else {
        assert.deepStrictEqual(telemetry, []);
    }
    if (mode === 'telemetry-failure') {
        assert.ok(diagnostics.some(message => message.indexOf('Unable to publish redaction telemetry: ') === 0));
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
