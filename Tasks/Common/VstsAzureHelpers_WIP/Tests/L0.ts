/// <reference path="../../../../definitions/mocha.d.ts"/>
/// <reference path="../../../../definitions/node.d.ts"/>
/// <reference path="../../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

describe('Common-VstsAzureHelpers_ Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done) => {
        if (psm.testSupported()) {
            psr = new psm.PSRunner();
            psr.start();
        }

        done();
    });

    after(function () {
        if (psr) {
            psr.kill();
        }
    });

    if (psm.testSupported()) {
        it('(Import-AzureModule) azure preferred falls back', (done) => {
            psr.run(path.join(__dirname, 'Import-AzureModule.AzurePreferredFallsBack.ps1'), done);
        })
        it('(Import-AzureModule) azure rm preferred falls back', (done) => {
            psr.run(path.join(__dirname, 'Import-AzureModule.AzureRMPreferredFallsBack.ps1'), done);
        })
        it('(Import-AzureModule) both preferred falls back', (done) => {
            psr.run(path.join(__dirname, 'Import-AzureModule.BothPreferredFallsBack.ps1'), done);
        })
        it('(Import-AzureModule) throws when not found', (done) => {
            psr.run(path.join(__dirname, 'Import-AzureModule.ThrowsWhenNotFound.ps1'), done);
        })
        it('(Import-AzureModule) validates classic version', (done) => {
            psr.run(path.join(__dirname, 'Import-AzureModule.ValidatesClassicVersion.ps1'), done);
        })
        it('(Import-FromModulePath) imports modules', (done) => {
            psr.run(path.join(__dirname, 'Import-FromModulePath.ImportsModules.ps1'), done);
        })
        it('(Import-FromModulePath) returns false when not found', (done) => {
            psr.run(path.join(__dirname, 'Import-FromModulePath.ReturnsFalseWhenNotFound.ps1'), done);
        })
        it('(Import-FromModulePath) validate RM profile found', (done) => {
            psr.run(path.join(__dirname, 'Import-FromModulePath.ValidatesRMProfileFound.ps1'), done);
        })
        it('(Import-FromSdkPath) imports module', (done) => {
            psr.run(path.join(__dirname, 'Import-FromSdkPath.ImportsModule.ps1'), done);
        })
        it('(Import-FromSdkPath) returns false when not found', (done) => {
            psr.run(path.join(__dirname, 'Import-FromSdkPath.ReturnsFalseWhenNotFound.ps1'), done);
        })
        it('(Initialize-Azure) passes inputs', (done) => {
            psr.run(path.join(__dirname, 'Initialize-Azure.PassesInputs.ps1'), done);
        })
        it('(Initialize-Azure) throws when service name is null', (done) => {
            psr.run(path.join(__dirname, 'Initialize-Azure.ThrowsWhenServiceNameIsNull.ps1'), done);
        })
        it('(Initialize-AzureSubscription) manged service identity should pass ', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.ManagedServiceIdentity.ps1'), done);
        })
        it('(Initialize-AzureSubscription) passes values when cert auth', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.PassesValuesWhenCertAuth.ps1'), done);
        })
        it('(Initialize-AzureSubscription) passes values when SP auth', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.PassesValuesWhenSPAuth.ps1'), done);
        })
        it('(Initialize-AzureSubscription) passes values when UP auth', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.PassesValuesWhenUPAuth.ps1'), done);
        })
        it('(Initialize-AzureSubscription) throws useful error when SP auth and add account fails', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.ThrowsUsefulErrorWhenSPAuthAndAddAccountFails.ps1'), done);
        })
        it('(Initialize-AzureSubscription) throws useful error when UP auth and add account fails', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.ThrowsUsefulErrorWhenUPAuthAndAddAccountFails.ps1'), done);
        })
        it('(Initialize-AzureSubscription) throws when RM and cert auth', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.ThrowsWhenRMAndCertAuth.ps1'), done);
        })
        it('(Initialize-AzureSubscription) passes values when cert auth and environment', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.PassesValuesWhenCertAuthAndEnvironment.ps1'), done);
        })
        it('(Initialize-AzureSubscription) passes values when cert auth with service principal scheme', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.PassesValuesWhenSPNCertAuth.ps1'), done);
        })
        it('(Initialize-AzureSubscription) passes values when cert auth with service principal scheme with AZ', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.PassesValuesWhenSPNCertAuthWithAZ.ps1'), done);
        })
        it('(Initialize-AzureSubscription) throws when SP auth and classic 0.9.9', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.ThrowsWhenSPAuthAndClassic099.ps1'), done);
        })
        it('(Initialize-AzureSubscription) throws when unsupported auth', (done) => {
            psr.run(path.join(__dirname, 'Initialize-AzureSubscription.ThrowsWhenUnsupportedAuth.ps1'), done);
        })
        it('(Set-CurrentAzureRMSubscription) passes values', (done) => {
            psr.run(path.join(__dirname, 'Set-CurrentAzureRMSubscription.PassesValues.ps1'), done);
        })
        it('(Set-CurrentAzureSubscription) passes values', (done) => {
            psr.run(path.join(__dirname, 'Set-CurrentAzureSubscription.PassesValues.ps1'), done);
        })
		it('(Set-UserAgent) passes values', (done) => {
            psr.run(path.join(__dirname, 'Set-UserAgent.PassesValues.ps1'), done);
        })
        it('Overriddes global debug preference', (done) => {
            psr.run(path.join(__dirname, 'OverriddesGlobalDebugPreference.ps1'), done);
        })
        it('(Get-MsiAccessToken) tests', (done) => {
            psr.run(path.join(__dirname, 'Get-MsiAccessTokenTests.ps1'), done);
        });
    }
});