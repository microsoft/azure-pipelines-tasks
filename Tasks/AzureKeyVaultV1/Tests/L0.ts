/// <reference path="../../../definitions/mocha.d.ts"/>
'use strict';

const assert = require('assert');
const ttm = require('azure-pipelines-task-lib/mock-test');
const path = require('path');

describe('Azure Key Vault', function () {
    this.timeout(30000);
    before((done) => {
        done();
    });
    after(function () {
    });
    it("Successfully download all secrets", (done) => {
        let tp = path.join(__dirname, "downloadAllSecrets.js");
        let tr = new ttm.MockTestRunner(tp);

        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("KeyVaultNameLabel RmCdpKeyVault") > 0, "KeyVaultNameLabel RmCdpKeyVault");
            assert(tr.stdout.indexOf("set SYSTEM_UNSAFEALLOWMULTILINESECRET=true") > 0, "set SYSTEM_UNSAFEALLOWMULTILINESECRET=true");
            assert(tr.stdout.indexOf("Downloading all secrets from subscriptionId: sId, vault: RmCdpKeyVault") > 0, "Downloading all secrets from subscriptionId: sId, vault: RmCdpKeyVault");
            assert(tr.stdout.indexOf("keyVaultClient.getSecrets is called") > 0, "keyVaultClient.getSecrets is called");
            assert(tr.stdout.indexOf("NumberOfSecretsFound RmCdpKeyVault 4") > 0, "NumberOfSecretsFound RmCdpKeyVault 4");
            assert(tr.stdout.indexOf("NumberOfEnabledSecretsFound RmCdpKeyVault 3") > 0, "NumberOfEnabledSecretsFound RmCdpKeyVault 3");
            assert(tr.stdout.indexOf("getSecretValue is called for secret1") > 0, "getSecretValue is called for secret1");
            assert(tr.stdout.indexOf("getSecretValue is called for secret2") > 0, "getSecretValue is called for secret2");
            assert(tr.stdout.indexOf("getSecretValue is called for secret3") > 0, "getSecretValue is called for secret3");

            assert(tr.stdout.indexOf("getSecretValue is called for secret4") < 0, "getSecretValue should not be called for secret4");

            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret1;isOutput=false;issecret=true;]secret1-value") > 0, "##vso[task.setvariable variable=secret1;isOutput=false;issecret=true;]secret1-value");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret2;isOutput=false;issecret=true;]secret2-value") > 0, "##vso[task.setvariable variable=secret2;isOutput=false;issecret=true;]secret2-value");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret3;isOutput=false;issecret=true;]secret3-value") > 0, "##vso[task.setvariable variable=secret3;isOutput=false;issecret=true;]secret3-value");
            
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret4;isOutput=false;issecret=true;]secret4-value") < 0, "secret4 value should not be set");

            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);    
        }
    });
    it("Successfully download selected secrets", (done) => {
        let tp = path.join(__dirname, "downloadSelectedSecrets.js");
        let tr = new ttm.MockTestRunner(tp);

        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");
            assert(tr.stdout.indexOf("KeyVaultNameLabel RmCdpKeyVault") > 0, "KeyVaultNameLabel RmCdpKeyVault");
            assert(tr.stdout.indexOf("set SYSTEM_UNSAFEALLOWMULTILINESECRET=true") > 0, "set SYSTEM_UNSAFEALLOWMULTILINESECRET=true");
            assert(tr.stdout.indexOf("Downloading all secrets from subscriptionId: sId, vault: RmCdpKeyVault") < 0, "Should not downloading all secrets");
            assert(tr.stdout.indexOf("keyVaultClient.getSecrets is called") < 0, "keyVaultClient.getSecrets should not be called");
            assert(tr.stdout.indexOf("NumberOfSecretsFound RmCdpKeyVault") < 0, "NumberOfSecretsFound RmCdpKeyVault should not be there");
            
            assert(tr.stdout.indexOf("getSecretValue is called for secret1") > 0, "getSecretValue is called for secret1");
            assert(tr.stdout.indexOf("getSecretValue is called for secret2") > 0, "getSecretValue is called for secret2");
            assert(tr.stdout.indexOf("getSecretValue is called for secret3/versionIdentifierGuid") > 0, "getSecretValue is called for secret3/versionIdentifierGuid");

            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret1;isOutput=false;issecret=true;]secret1-value") > 0, "##vso[task.setvariable variable=secret1;isOutput=false;issecret=true;]secret1-value");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret2;isOutput=false;issecret=true;]secret2-value") > 0, "##vso[task.setvariable variable=secret2;isOutput=false;issecret=true;]secret2-value");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret3;isOutput=false;issecret=true;]secret3/versionIdentifierGuid-value") > 0, "##vso[task.setvariable variable=secret3;isOutput=false;issecret=true;]secret3/versionIdentifierGuid-value");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret3/versionIdentifierGuid;isOutput=false;issecret=true;]secret3/versionIdentifierGuid-value") > 0, "##vso[task.setvariable variable=secret3/versionIdentifierGuid;isOutput=false;issecret=true;]secret3/versionIdentifierGuid-value");
            
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret4;isOutput=false;issecret=true;]secret4-value") < 0, "secret4 value should not be set");

            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);    
        }
    });
    it("Task fails if key vault name is not specified", (done) => {
        let tp = path.join(__dirname, "downloadSecretsWithoutKeyVault.js");
        let tr = new ttm.MockTestRunner(tp);

        tr.run();
        try {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("Error: Input required: KeyVaultName") > 0, "Error: Input required: KeyVaultName");

            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);    
        }
    });
    it("Task fails if secret filter is not specified", (done) => {
        let tp = path.join(__dirname, "downloadSecretsWithoutSecrets.js");
        let tr = new ttm.MockTestRunner(tp);

        tr.run();
        try {
            assert(tr.failed, "Should have failed");
            assert(tr.stdout.indexOf("Error: Input required: SecretsFilter") > 0, "Error: Input required: SecretsFilter");

            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);    
        }
    });
});
