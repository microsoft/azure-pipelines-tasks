/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');
var ps = shell.which('powershell');

describe('Common-AzureHelpers Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        it('(Import-AzureModule) falls back', (done) => {
            psm.runPS(path.join(__dirname, 'Import-AzureModule.FallsBack.ps1'), done);
        })
        it('(Import-AzureModule) throws when not found', (done) => {
            psm.runPS(path.join(__dirname, 'Import-AzureModule.ThrowsWhenNotFound.ps1'), done);
        })
        it('(Import-AzureModule) validates classic version', (done) => {
            psm.runPS(path.join(__dirname, 'Import-AzureModule.ValidatesClassicVersion.ps1'), done);
        })
        it('(Import-FromModulePath) imports modules', (done) => {
            psm.runPS(path.join(__dirname, 'Import-FromModulePath.ImportsModules.ps1'), done);
        })
        it('(Import-FromModulePath) returns false when not found', (done) => {
            psm.runPS(path.join(__dirname, 'Import-FromModulePath.ReturnsFalseWhenNotFound.ps1'), done);
        })
        it('(Import-FromModulePath) validate RM profile found', (done) => {
            psm.runPS(path.join(__dirname, 'Import-FromModulePath.ValidatesRMProfileFound.ps1'), done);
        })
        it('(Import-FromSdkPath) imports module', (done) => {
            psm.runPS(path.join(__dirname, 'Import-FromSdkPath.ImportsModule.ps1'), done);
        })
        it('(Import-FromSdkPath) returns false when not found', (done) => {
            psm.runPS(path.join(__dirname, 'Import-FromSdkPath.ReturnsFalseWhenNotFound.ps1'), done);
        })
        it('(Initialize-Azure) passes inputs', (done) => {
            psm.runPS(path.join(__dirname, 'Initialize-Azure.PassesInputs.ps1'), done);
        })
        it('(Initialize-Azure) throws when service name is null', (done) => {
            psm.runPS(path.join(__dirname, 'Initialize-Azure.ThrowsWhenServiceNameIsNull.ps1'), done);
        })
        it('(Initialize-AzureSubscription) passes values when cert auth', (done) => {
            psm.runPS(path.join(__dirname, 'Initialize-AzureSubscription.PassesValuesWhenCertAuth.ps1'), done);
        })
        it('(Initialize-AzureSubscription) passes values when SP auth', (done) => {
            psm.runPS(path.join(__dirname, 'Initialize-AzureSubscription.PassesValuesWhenSPAuth.ps1'), done);
        })
        it('(Initialize-AzureSubscription) passes values when UP auth', (done) => {
            psm.runPS(path.join(__dirname, 'Initialize-AzureSubscription.PassesValuesWhenUPAuth.ps1'), done);
        })
        it('(Initialize-AzureSubscription) throws useful error when SP auth and add account fails', (done) => {
            psm.runPS(path.join(__dirname, 'Initialize-AzureSubscription.ThrowsUsefulErrorWhenSPAuthAndAddAccountFails.ps1'), done);
        })
        it('(Initialize-AzureSubscription) throws useful error when UP auth and add account fails', (done) => {
            psm.runPS(path.join(__dirname, 'Initialize-AzureSubscription.ThrowsUsefulErrorWhenUPAuthAndAddAccountFails.ps1'), done);
        })
        it('(Initialize-AzureSubscription) throws when RM and cert auth', (done) => {
            psm.runPS(path.join(__dirname, 'Initialize-AzureSubscription.ThrowsWhenRMAndCertAuth.ps1'), done);
        })
        it('(Initialize-AzureSubscription) throws when SP auth and classic 0.9.9', (done) => {
            psm.runPS(path.join(__dirname, 'Initialize-AzureSubscription.ThrowsWhenSPAuthAndClassic099.ps1'), done);
        })
        it('(Initialize-AzureSubscription) throws when unsupported auth', (done) => {
            psm.runPS(path.join(__dirname, 'Initialize-AzureSubscription.ThrowsWhenUnsupportedAuth.ps1'), done);
        })
        it('(Set-CurrentAzureRMSubscription) passes values', (done) => {
            psm.runPS(path.join(__dirname, 'Set-CurrentAzureRMSubscription.PassesValues.ps1'), done);
        })
        it('(Set-CurrentAzureSubscription) passes values', (done) => {
            psm.runPS(path.join(__dirname, 'Set-CurrentAzureSubscription.PassesValues.ps1'), done);
        })
    }
});