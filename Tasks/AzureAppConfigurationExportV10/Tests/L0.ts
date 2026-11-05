import * as assert from 'assert';
import path = require('path');
import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import * as tl from 'azure-pipelines-task-lib/task';
import { createHttpHeaders, HttpClient } from '@azure/core-rest-pipeline';
import { SecretClient } from '@azure/keyvault-secrets';
import { ApplicationTokenCredentials } from 'azure-pipelines-tasks-azure-arm-rest/azure-arm-common';
import { AzureEndpoint } from 'azure-pipelines-tasks-azure-arm-rest/azureModels';
import { ConnectedServiceCredential } from '../connectedServiceCredentials';
import { KeyVaultClient } from '../keyVaultClient';
import { AzureEnvironments, KeyVaultHostNameSuffix } from '../constants';
import { ArgumentError, ArgumentNullError } from '../errors';

describe("Key Vault reference URL validation", function() {
    const originalGetSecret = SecretClient.prototype.getSecret;
    let requestCount: number;

    before(() => {
        tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
    });

    beforeEach(() => {
        requestCount = 0;
        SecretClient.prototype.getSecret = async function(name) {
            requestCount++;
            assert.strictEqual(name, 'sample');
            return {
                name,
                value: 'secret value',
                properties: { id: 'secret-id', vaultUrl: this.vaultUrl, name }
            };
        };
    });

    afterEach(() => {
        SecretClient.prototype.getSecret = originalGetSecret;
    });

    function createClient(environment: string): KeyVaultClient {
        const endpoint: AzureEndpoint = {
            subscriptionName: 'subscription',
            tenantID: 'tenant',
            environmentAuthorityUrl: 'https://login.microsoftonline.com/',
            url: 'https://management.azure.com/',
            environment,
            activeDirectoryResourceID: 'https://management.azure.com/',
            applicationTokenCredentials: undefined
        };
        return new KeyVaultClient(endpoint);
    }

    const clouds = [
        { environment: AzureEnvironments.AzurePublicCloud, suffix: KeyVaultHostNameSuffix.AzurePublicCloud },
        { environment: AzureEnvironments.AzureChina, suffix: KeyVaultHostNameSuffix.AzureChina },
        { environment: AzureEnvironments.AzureGovernment, suffix: KeyVaultHostNameSuffix.AzureGovernment }
    ];

    for (const cloud of clouds) {
        for (const secretUrl of [
            `https://my-vault.${cloud.suffix}/secrets/sample`,
            `https://my-vault.${cloud.suffix}/secrets/sample/version`,
            `https://MY-VAULT.${cloud.suffix.toUpperCase()}:443/secrets/sample`
        ]) {
            it(`Accepts ${secretUrl}`, async () => {
                const secret = await createClient(cloud.environment).getSecret({
                    key: 'reference',
                    isReadOnly: false,
                    value: { secretId: secretUrl }
                });
                assert.deepStrictEqual(secret, { value: 'secret value', id: 'secret-id' });
                assert.strictEqual(requestCount, 1);
            });
        }

        for (const secretUrl of [
            `https://callback.example\\reference.${cloud.suffix}/reference.${cloud.suffix}/version`,
            `https://callback.example\\\\reference.${cloud.suffix}/reference.${cloud.suffix}/version`,
            `https://not${cloud.suffix}/secrets/sample`,
            `https://${cloud.suffix}/secrets/sample`,
            `https://my-vault.${cloud.suffix}.example/secrets/sample`,
            `https://my-vault.${cloud.suffix}@callback.example/secrets/sample`,
            `https://user@my-vault.${cloud.suffix}/secrets/sample`,
            `https://user:password@my-vault.${cloud.suffix}/secrets/sample`,
            `https://my-vault.${cloud.suffix}:8443/secrets/sample`,
            `http://my-vault.${cloud.suffix}/secrets/sample`,
            `ftp://my-vault.${cloud.suffix}/secrets/sample`,
            ...clouds.filter(other => other !== cloud)
                .map(other => `https://my-vault.${other.suffix}/secrets/sample`),
            'not a URL',
            ''
        ]) {
            it(`Rejects ${secretUrl} in ${cloud.environment} before requesting a secret`, async () => {
                await assert.rejects(() => createClient(cloud.environment).getSecret({
                    key: 'reference',
                    isReadOnly: false,
                    value: { secretId: secretUrl }
                }), ArgumentError);
                assert.strictEqual(requestCount, 0);
            });
        }
    }

    it("Preserves the null secret URL error", async () => {
        await assert.rejects(() => createClient(AzureEnvironments.AzurePublicCloud).getSecret({
            key: 'reference',
            isReadOnly: false,
            value: { secretId: null }
        }), ArgumentNullError);
        assert.strictEqual(requestCount, 0);
    });
});

describe("Key Vault credential scope validation", function() {
    const armAudience = 'https://management.azure.com/';
    const keyVaultAudiences = [
        `https://${KeyVaultHostNameSuffix.AzurePublicCloud}`,
        `https://${KeyVaultHostNameSuffix.AzureChina}`,
        `https://${KeyVaultHostNameSuffix.AzureGovernment}`
    ];
    const otherAudience = 'https://other.example';
    const testToken = 'test-token';
    const invalidScopeMessage = 'The requested token scope does not match the configured service audience.';
    let endpoint: AzureEndpoint;
    let tokenRequests: number;
    let authorizationHeaders: (string | undefined)[];

    before(() => {
        tl.setResourcePath(path.join(__dirname, '..', 'task.json'));
    });

    beforeEach(() => {
        tokenRequests = 0;
        authorizationHeaders = [];
        endpoint = {
            subscriptionName: 'subscription',
            tenantID: 'tenant',
            environmentAuthorityUrl: 'https://login.microsoftonline.com/',
            url: armAudience,
            environment: AzureEnvironments.AzurePublicCloud,
            activeDirectoryResourceID: armAudience,
            applicationTokenCredentials: new ApplicationTokenCredentials(
                'connection', 'client', 'tenant', undefined, armAudience,
                'https://login.microsoftonline.com/', armAudience, false, 'WorkloadIdentityFederation'
            )
        };
        endpoint.applicationTokenCredentials.getToken = async (force) => {
            tokenRequests++;
            assert.strictEqual(force, true);
            return testToken;
        };
    });

    function createHttpClient(responseBody: object, challenge: string): HttpClient {
        return {
            async sendRequest(request) {
                authorizationHeaders.push(request.headers.get('authorization'));
                if (authorizationHeaders.length === 1) {
                    return {
                        request,
                        status: 401,
                        headers: createHttpHeaders({
                            'www-authenticate': `Bearer authorization="https://login.microsoftonline.com/tenant", ${challenge}`
                        })
                    };
                }
                return {
                    request,
                    status: 200,
                    headers: createHttpHeaders({ 'content-type': 'application/json' }),
                    bodyAsText: JSON.stringify(responseBody)
                };
            }
        };
    }

    it("Accepts Key Vault scope names as strings or single-element arrays", async () => {
        const scopeNames = ['.default', 'user_impersonation'];
        for (const audience of keyVaultAudiences) {
            const credential = new ConnectedServiceCredential(endpoint, audience);
            for (const scopeName of scopeNames) {
                const scope = `${audience}/${scopeName}`;
                for (const scopes of [scope, [scope]]) {
                    const token = await credential.getToken(scopes);
                    assert.strictEqual(token.token, testToken);
                    assert.strictEqual(endpoint.applicationTokenCredentials.activeDirectoryResourceId, audience);
                }
            }
        }
        assert.strictEqual(tokenRequests, keyVaultAudiences.length * scopeNames.length * 2);
    });

    it("Rejects invalid Key Vault scopes before requesting a token or changing the resource", async () => {
        const credential = new ConnectedServiceCredential(endpoint, keyVaultAudiences[0]);
        const expectedScope = `${keyVaultAudiences[0]}/.default`;
        const otherScope = `${otherAudience}/.default`;
        const invalidScopes: (string | string[])[] = [
            undefined, null, '', [], [''],
            otherScope, [otherScope],
            [expectedScope, otherScope], [otherScope, expectedScope], [expectedScope, expectedScope],
            keyVaultAudiences[0], `${keyVaultAudiences[1]}/.default`,
            'http://vault.azure.net/.default', 'https://vault.azure.net.example/.default'
        ];
        for (const scopes of invalidScopes) {
            await assert.rejects(
                () => credential.getToken(scopes),
                (error: Error) => error.constructor === Error && error.message === invalidScopeMessage,
                `Scope input: ${JSON.stringify(scopes)}`
            );
            assert.strictEqual(tokenRequests, 0);
            assert.strictEqual(endpoint.applicationTokenCredentials.activeDirectoryResourceId, armAudience);
        }
    });

    for (const audience of keyVaultAudiences) {
        it(`Accepts the Key Vault SDK challenge for ${audience}`, async () => {
            const vaultUrl = audience.replace('https://', 'https://my-vault.');
            const credential = new ConnectedServiceCredential(endpoint, audience);
            const client = new SecretClient(vaultUrl, credential, {
                retryOptions: { maxRetries: 0 },
                httpClient: createHttpClient({
                    value: 'secret value',
                    id: `${vaultUrl}/secrets/sample/version`
                }, `resource="${audience}"`)
            });

            const secret = await client.getSecret('sample');

            assert.strictEqual(secret.value, 'secret value');
            assert.deepStrictEqual(authorizationHeaders, [undefined, `Bearer ${testToken}`]);
            assert.strictEqual(tokenRequests, 1);
            assert.strictEqual(endpoint.applicationTokenCredentials.activeDirectoryResourceId, audience);
        });
    }

    for (const challenge of [
        `resource="${otherAudience}"`,
        `scope="${otherAudience}/user_impersonation"`
    ]) {
        it(`Rejects the Key Vault SDK challenge ${challenge} without obtaining or sending a token`, async () => {
            const credential = new ConnectedServiceCredential(endpoint, keyVaultAudiences[0]);
            const client = new SecretClient('https://callback.other.example', credential, {
                retryOptions: { maxRetries: 0 },
                httpClient: createHttpClient({}, challenge)
            });

            await assert.rejects(
                () => client.getSecret('sample'),
                (error: Error) => error.constructor === Error && error.message === invalidScopeMessage
            );
            assert.deepStrictEqual(authorizationHeaders, [undefined]);
            assert.strictEqual(tokenRequests, 0);
            assert.strictEqual(endpoint.applicationTokenCredentials.activeDirectoryResourceId, armAudience);
        });
    }

});

describe("Export task configuration settings test", function(){
    this.timeout(30000);

    before(async ()=> {
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALID"] = "spId";
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_SERVICEPRINCIPALKEY"] = "spKey";
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_TENANTID"] = "tenant";
        process.env["ENDPOINT_AUTH_PARAMETER_AzureRMSpn_AUTHENTICATIONTYPE"] = "spnKey";
        process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONNAME"] = "sName";
        process.env["ENDPOINT_DATA_AzureRMSpn_SUBSCRIPTIONID"] =  "sId";
        process.env["ENDPOINT_DATA_AzureRMSpn_GRAPHURL"] = "https://graph.windows.net/";
        process.env["ENDPOINT_DATA_AzureRMSpn_ENVIRONMENT"] = "AzureCloud";
        process.env["ENDPOINT_URL_AzureRMSpn"] = "https://management.azure.com/";
        process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  "C:\\a\\w\\";
        process.env["AGENT_TEMPDIRECTORY"] = process.cwd();
    });

    function runValidations(validator: () => void, testRunner) {
        try {
            validator();
        } catch (error) {
            console.log("STDERR", testRunner.stderr);
            console.log("STDOUT", testRunner.stdout);
            console.log("Error", error);
        }
    }

    it("Successfully download key-values and key vault reference", async()=> {
        const taskPath = path.join(__dirname, "downloadKeyValues.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.ok(tr.stdout.indexOf("loc_mock_AppConfigurationEndpointTitle https://Test.azconfig.io") >= 0, "App Configuration Endpoint: https://Test.azconfig.io");
            assert.ok(tr.stdout.indexOf("loc_mock_RetrievedKeyValues 5") > 0, "'5' key-values were retrieved from Azure App Configuration.");
            // key value pairs expected 
            assert.ok(tr.stdout.indexOf("##vso[task.setvariable variable=Mvc:FontColor;isOutput=false;issecret=false;]orange") > 0, "##vso[task.setvariable variable=Mvc:FontColor;isOutput=false;issecret=false;]orange");
            assert.ok(tr.stdout.indexOf("##vso[task.setvariable variable=Mvc:BackGroundColor;isOutput=false;issecret=false;]white") > 0, "##vso[task.setvariable variable=Mvc:BackGroundColor;isOutput=false;issecret=false;]white");
            assert.ok(tr.stdout.indexOf("##vso[task.setvariable variable=Message;isOutput=false;issecret=false;]Test 1") > 0, "##vso[task.setvariable variable=Message;isOutput=false;issecret=false;]Test 1");
        },tr);
    });

    it("Successfully download key-values with key filter, default selection mode", async()=> {
        const taskPath = path.join(__dirname, "downloadKeyValuesWithFilter.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.ok(tr.stdout.indexOf("loc_mock_AppConfigurationEndpointTitle https://Test.azconfig.io") >= 0, "App Configuration Endpoint: https://Test.azconfig.io");
            assert.ok(tr.stdout.indexOf(" 'S*'") > 0, "'S*'");
        }, tr);
    });

    it("Successfully download key values from snapshot, snapshot selection mode", async()=> {
        const taskPath = path.join(__dirname, "downloadKeyValuesFromSnapshot.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.ok(tr.stdout.indexOf("loc_mock_AppConfigurationEndpointTitle https://Test.azconfig.io") >= 0, "App Configuration Endpoint: https://Test.azconfig.io");
            assert.ok(tr.stdout.indexOf(`loc_mock_RetrievedKeyValues 3`) > 0, "'3' key-values were retrieved from Azure App Configuration.");
            // key value pairs expected
            assert.ok(tr.stdout.indexOf("##vso[task.setvariable variable=Message;isOutput=false;issecret=false;]orange") > 0, "##vso[task.setvariable variable=Message;isOutput=false;issecret=false;]orange");
            assert.ok(tr.stdout.indexOf("##vso[task.setvariable variable=Mvc:BackGroundColor;isOutput=false;issecret=false;]white") > 0, "##vso[task.setvariable variable=Mvc:BackGroundColor;isOutput=false;issecret=false;]white");
        },tr);
    });

    it("Handle invalid selection mode", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithInvalidSelection.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "should not succeeded");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues[0], `loc_mock_SupportedOptionsForSelectionMode Default Snapshot`,"should print std out" );
        },tr);
    });

    it("Handle forbidden key vault request", async()=>{
        const taskPath = path.join(__dirname, "downloadKeyVaultRefWithForbidden.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "should not succeed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_AccessDeniedToUrl https://my-vault.vault.azure.net/secrets/TestMessage Status code: 403", "Should have error message");
        },tr);
    });

    it("Handle forbidden request",async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithForbidden.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "Should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_AccessDenied Status code: 403", "Should have error message");
        },tr);
    });

    it("Handle unauthorized request", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithUnauthorized.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "Should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_AuthenticationRestError 401 https://test.azconfig.io  HMAC 12345908");
        }, tr);
    });

    it("Handle multiline secrets present in key vault reference", async()=>{
        const taskPath = path.join(__dirname, "downloadSecretWithMultiline.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "should not succeed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_FailedToSetSecretVariable Settings:KeyVault:Message");
        }, tr);
    });

    it("Throw error when pull key-values from snapshot with composition type Key Label", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithInvalidCompositionType.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "Should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], `loc_mock_InvalidCompositionTypeValue key_label key`, "Should have error message");
        }, tr);
    });

    it("Handle a snapshot not found", async()=>{
        const taskPath = path.join(__dirname, "downloadKVSnapshotNotFound.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "Should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_SnapshotNotFound testSnapshot Status code: 404", "Should have error message");
        }, tr);
    });

    it("Successfully suppress warning for overridden key values", async()=>{
        const taskPath = path.join(__dirname, "downloadDuplicateKVSuppressWarning.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "Should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
        }, tr);
    });

    it("Treat key vault reference resolution error as a warning", async()=>{
        const taskPath = path.join(__dirname, "downloadKeyVaultRefSuppressWarning.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "should succeed");
            assert.strictEqual(tr.warningIssues.length, 1, "should have one warning");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.strictEqual(tr.warningIssues[0], "loc_mock_FailedToSetSecretVariable Settings:KeyVault:Message");
        }, tr);
    });

    it("Handle invalid app configuration endpoint", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithInvalidEndpoint.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "should not succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0],"loc_mock_InvalidAppConfigurationEndpoint Test.azconfig.io");
        }, tr);
    });

    it("Warn when pulling key-values from an archived snapshot", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithArchivedSnapshot.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "Should succeeded");
            assert.strictEqual(tr.warningIssues.length, 1, "should have one warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.strictEqual(tr.warningIssues[0], `loc_mock_ArchivedSnapshotWarning testSnapshot ${new Date("2023-12-12")}`, "should have warning message");
        }, tr);
    });

    it("Warn when pulling key-values and duplicate key-values are present", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithDuplicateKey.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();
        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "Should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 1, "should have one warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.strictEqual(tr.warningIssues[0],'loc_mock_DuplicateKeysFound 1',"should have warning message")
        }, tr);
    });

    it("Throw for an invalid key vault secret url", async()=>{
        const taskPath = path.join(__dirname, "downloadKVWithInvalidSecretUrl.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, false, "should not succeed");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warning");
            assert.strictEqual(tr.errorIssues.length, 1, "should have one error");
            assert.strictEqual(tr.errorIssues[0], "loc_mock_InvalidSecretUrl");
        },tr);
    });

    it("Trim any trailing forward slash in a store endpoint", async()=> {
        const taskPath = path.join(__dirname, "downloadKVWithInvalidStoreEndpoint.js");
        const tr = new MockTestRunner(taskPath);

        await tr.runAsync();

        runValidations(()=>{ 
            assert.strictEqual(tr.succeeded, true, "should have succeeded");
            assert.strictEqual(tr.warningIssues.length, 0, "should have no warnings");
            assert.strictEqual(tr.errorIssues.length, 0, "should have no errors");
            assert.ok(tr.stdout.indexOf("loc_mock_AppConfigurationEndpointTitle https://Test.azconfig.io") >= 0, "App Configuration Endpoint: https://Test.azconfig.io");
        },tr);
    });
})