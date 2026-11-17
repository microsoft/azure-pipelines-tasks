import * as assert from 'assert';
import * as mocker from 'azure-pipelines-task-lib/lib-mocker';
import * as tl from 'azure-pipelines-task-lib/task';

const mode = process.argv[2];
const enabled = mode !== 'false' && mode !== 'unset';
const hasDatabase = mode !== 'no-database';
const hasAttributeLeak = mode === 'attribute-leak';
const featureVariable = 'DISTRIBUTEDTASK_TASKS_ENABLEPUBLISHPROFILELOGREDACTION';
if (mode === 'unset') {
    delete process.env[featureVariable];
} else {
    process.env[featureVariable] = enabled ? 'true' : 'false';
}

const userNameValue: unknown = hasAttributeLeak
    ? { _: 'demoapp', $: { AltId: 'HiddenAttributeSecret' } }
    : 'demoapp';

const safe: Record<string, unknown> = {
    WebPublishMethod: ['MSDeploy'],
    MSDeployServiceURL: ['localhost'],
    DeployIisAppPath: ['demoapp']
};
if (!hasAttributeLeak) {
    safe.UserName = ['demoapp'];
}
const database = { ObjectGroup: [{ Destination: [{ $: { Path: 'Password=DbPoC7' } }] }] };
const profile = {
    WebPublishMethod: ['MSDeploy'],
    MSDeployServiceURL: ['localhost'],
    DeployIisAppPath: ['demoapp'],
    UserName: [userNameValue],
    UserPWD: ['FakePublishPassword'],
    OtherSecret: ['FakeFutureSecret'],
    ...(hasDatabase ? { PublishDatabaseSettings: [database] } : {})
};
const userNameXml = hasAttributeLeak
    ? '<UserName AltId="HiddenAttributeSecret">demoapp</UserName>'
    : '<UserName>demoapp</UserName>';
const xml = `<Project><PropertyGroup>
    <WebPublishMethod>MSDeploy</WebPublishMethod>
    <MSDeployServiceURL>localhost</MSDeployServiceURL>
    <DeployIisAppPath>demoapp</DeployIisAppPath>
    ${userNameXml}
    <UserPWD>FakePublishPassword</UserPWD>
    <OtherSecret>FakeFutureSecret</OtherSecret>
    ${hasDatabase ? '<PublishDatabaseSettings><ObjectGroup><Destination Path="Password=DbPoC7" /></ObjectGroup></PublishDatabaseSettings>' : ''}
</PropertyGroup></Project>`;
const diagnostics: string[] = [];
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
        droppedFieldCount: (hasDatabase ? 3 : 2) + (hasAttributeLeak ? 1 : 0),
        hasNestedDbSettings: hasDatabase
    });
    assert.strictEqual(JSON.stringify(profile), snapshot, 'Redaction must not mutate the deployment profile');
    assert.deepStrictEqual(getRedactedPublishProfileForLog({}), {
        safe: {}, droppedFieldCount: 0, hasNestedDbSettings: false
    });

    const utility = new PublishProfileUtility('test.pubxml');
    assert.strictEqual(await utility.GetPropertyValuefromPublishProfile('UserPWD'), 'FakePublishPassword');
    assert.strictEqual(await utility.GetPropertyValuefromPublishProfile('OtherSecret'), 'FakeFutureSecret');
    assert.deepStrictEqual(await utility.GetPropertyValuefromPublishProfile('UserName'), userNameValue,
        'The real deployment value must be unaffected by log redaction, attribute-bearing or not');
    if (hasDatabase) {
        assert.deepStrictEqual(await utility.GetPropertyValuefromPublishProfile('PublishDatabaseSettings'), database);
    }

    const profileLogs = diagnostics.filter(message => message.startsWith('Publish Profile: '));
    assert.deepStrictEqual(profileLogs, ['Publish Profile: ' + JSON.stringify(enabled ? safe : profile)]);
    if (enabled) {
        const secretsToCheck = ['DbPoC7', 'FakePublishPassword', 'FakeFutureSecret'];
        if (hasAttributeLeak) {
            secretsToCheck.push('HiddenAttributeSecret');
        }
        for (const secret of secretsToCheck) {
            assert.strictEqual(diagnostics.join('\n').indexOf(secret), -1);
        }
    }
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
