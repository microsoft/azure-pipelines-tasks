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

            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret1;isOutput=false;issecret=true;]secret1-value") > 0, "##vso[task.setvariable variable=secret1;issecret=true;]secret1-value");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret2;isOutput=false;issecret=true;]secret2-value") > 0, "##vso[task.setvariable variable=secret2;issecret=true;]secret2-value");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret3;isOutput=false;issecret=true;]secret3/versionIdentifierGuid-value") > 0, "##vso[task.setvariable variable=secret3;issecret=true;]secret3/versionIdentifierGuid-value");
            assert(tr.stdout.indexOf("##vso[task.setvariable variable=secret3/versionIdentifierGuid;isOutput=false;issecret=true;]secret3/versionIdentifierGuid-value") > 0, "##vso[task.setvariable variable=secret3/versionIdentifierGuid;issecret=true;]secret3/versionIdentifierGuid-value");
            
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

    // MSRC case 169467: trySetSecret() prints "##vso[task.setsecret]" + fragment via a raw
    // console.log call that bypasses azure-pipelines-task-lib's command formatter (which normally
    // escapes CR/LF as %0D/%0A). A secret containing a literal LF (entering the multi-line/masking
    // branch) whose LF-delimited fragment still contains a bare CR right before a "##vso[" prefix
    // gets printed with that CR intact. The real agent's StreamReader.ReadLine() treats CR, LF, or
    // CRLF all as line terminators, so it splits that single printed line into two, exposing the
    // "##vso[...]" suffix as its own, attacker-controlled agent command line.
    const forgedCommandLinePrefix = "##vso[task.setvariable variable=BASH_ENV]";

    // The mock test runner spawns the task as a child process; on Windows its captured stdout
    // uses "\r\n" for ordinary line endings (azure-pipelines-task-lib's own mock-test.js performs
    // the same normalization internally before tracing output). Collapsing only exact "\r\n"
    // pairs strips that harness artifact while leaving any genuine bare CR (not followed by LF) -
    // i.e. exactly the pattern these tests are checking for - untouched.
    function getRawLines(stdout: string): string[] {
        return stdout.replace(/\r\n/g, '\n').split('\n');
    }

    // Reverses azure-pipelines-task-lib's command escaping (escapedata() in taskcommand.ts) so a
    // captured ##vso[task.setvariable ...]<value> line can be compared against the original,
    // un-escaped secret value.
    function unescapeCommandValue(value: string): string {
        return value.replace(/%0D/g, '\r').replace(/%0A/g, '\n').replace(/%AZP25/g, '%');
    }

    it("CR/LF masking fix flag off: reproduces the known pre-fix behavior (regression baseline)", (done) => {
        let tp = path.join(__dirname, "downloadSecretCrInjectionFlagOff.js");
        let tr = new ttm.MockTestRunner(tp);

        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");

            const agentLines = tr.stdout.split(/\r\n|\r|\n/);
            const injectedCommandSmuggled = agentLines.some((line: string) => line.startsWith(forgedCommandLinePrefix));
            assert(injectedCommandSmuggled, "Expected the known pre-fix behavior: the injected ##vso command is split onto its own line when the flag is off");

            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it("CR/LF masking fix flag on: injected ##vso command is never split onto its own line", (done) => {
        let tp = path.join(__dirname, "downloadSecretCrInjectionFlagOn.js");
        let tr = new ttm.MockTestRunner(tp);

        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");

            // Raw per-call lines (Windows CRLF artifacts normalized away, see getRawLines) - this
            // is what actually got printed, *before* simulating the agent's CR/LF/CRLF
            // re-splitting below. A masking line must never contain a raw CR here, otherwise the
            // agent's real line reader (which the next assertion simulates) could still split it.
            const rawLines = getRawLines(tr.stdout);
            const maskingLines = rawLines.filter((line: string) => line.startsWith("##vso[task.setsecret]"));
            assert(maskingLines.length > 0, "Expected ##vso[task.setsecret] masking line(s) to be emitted");
            assert(maskingLines.every((line: string) => line.indexOf("\r") < 0), "No masking line may contain a raw CR character before agent-side line splitting");

            const agentLines = tr.stdout.split(/\r\n|\r|\n/);
            const injectedCommandSmuggled = agentLines.some((line: string) => line.startsWith(forgedCommandLinePrefix));
            assert(!injectedCommandSmuggled, "The injected ##vso[task.setvariable variable=BASH_ENV] command must never appear as its own agent command line when the fix is enabled");

            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it("CR-only (no LF) secret flag on: masked per-fragment without a smuggled command line", (done) => {
        let tp = path.join(__dirname, "downloadSecretCrOnlyFlagOn.js");
        let tr = new ttm.MockTestRunner(tp);
        const originalSecretValue = require("./mock_node_modules/azure-arm-keyvault-cronly").secretValue;

        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");

            const rawLines = getRawLines(tr.stdout);
            const maskingLines = rawLines.filter((line: string) => line.startsWith("##vso[task.setsecret]"));
            assert(maskingLines.length > 0, "Expected ##vso[task.setsecret] masking line(s) to be emitted for a CR-only secret when the fix is enabled");
            assert(maskingLines.every((line: string) => line.indexOf("\r") < 0), "No masking line may contain a raw CR character");

            const agentLines = tr.stdout.split(/\r\n|\r|\n/);
            const injectedCommandSmuggled = agentLines.some((line: string) => line.startsWith(forgedCommandLinePrefix));
            assert(!injectedCommandSmuggled, "The injected ##vso[task.setvariable variable=BASH_ENV] command must never appear as its own agent command line");

            const setVarLine = rawLines.find((line: string) => line.startsWith("##vso[task.setvariable variable=crOnlySecret;"));
            assert(setVarLine, "Expected a ##vso[task.setvariable variable=crOnlySecret;...] line");
            const storedValue = unescapeCommandValue(setVarLine.substring(setVarLine.indexOf(']') + 1));
            assert.strictEqual(storedValue, originalSecretValue, "The stored variable value must be preserved exactly for a CR-only secret");

            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });

    it("CR-only JSON secret flag on: stored variable value is not JSON-flattened", (done) => {
        let tp = path.join(__dirname, "downloadSecretCrOnlyJsonFlagOn.js");
        let tr = new ttm.MockTestRunner(tp);
        const originalSecretValue = require("./mock_node_modules/azure-arm-keyvault-cronlyjson").secretValue;

        tr.run();
        try {
            assert(tr.succeeded, "Should have succeeded");

            const rawLines = getRawLines(tr.stdout);
            const setVarLine = rawLines.find((line: string) => line.startsWith("##vso[task.setvariable variable=crOnlyJsonSecret;"));
            assert(setVarLine, "Expected a ##vso[task.setvariable variable=crOnlyJsonSecret;...] line");
            const storedValue = unescapeCommandValue(setVarLine.substring(setVarLine.indexOf(']') + 1));

            assert.strictEqual(storedValue, originalSecretValue, "A CR-only (no LF) secret must never be routed through JSON flattening, even when the masking fix is enabled - its stored value must stay byte-for-byte identical to the original");
            assert(rawLines.every((line: string) => line.indexOf("has been converted to single line") < 0), "tryFlattenJson's conversion message must not be printed for a CR-only secret");

            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    });
});
