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
console.log(ps);
describe('PublishSymbols Suite', function () {
    this.timeout(10000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        it('(Add-DbghelpLibrary) loads if not loaded', (done) => {
            psm.runPS(path.join(__dirname, 'Add-DbghelpLibrary.LoadsIfNotLoaded.ps1'), done);
        })
        it('(Add-DbghelpLibrary) skips if already loaded', (done) => {
            psm.runPS(path.join(__dirname, 'Add-DbghelpLibrary.SkipsIfAlreadyLoaded.ps1'), done);
        })
        it('(Add-DbghelpLibrary) throws if dll not found', (done) => {
            psm.runPS(path.join(__dirname, 'Add-DbghelpLibrary.ThrowsIfDllNotFound.ps1'), done);
        })
        it('(Add-DbghelpLibrary) warns if different location already loaded', (done) => {
            psm.runPS(path.join(__dirname, 'Add-DbghelpLibrary.WarnsIfDifferentLocationAlreadyLoaded.ps1'), done);
        })
        it('(Add-SourceServerStream) instruments pdb', (done) => {
            psm.runPS(path.join(__dirname, 'Add-SourceServerStream.InstrumentsPdb.ps1'), done);
        })
        it('(Add-SourceServerStream) specially handles pdbs with spaces', (done) => {
            psm.runPS(path.join(__dirname, 'Add-SourceServerStream.SpeciallyHandlesPdbsWithSpaces.ps1'), done);
        })
        it('(Get-SourceFilePaths) returns multiple files', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SourceFilePaths.ReturnsMultipleFiles.ps1'), done);
        })
        it('(Get-SourceFilePaths) throws if pdb not found', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SourceFilePaths.ThrowsIfPdbNotFound.ps1'), done);
        })
        it('(Get-SourceFilePaths) warns for no source files', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SourceFilePaths.WarnsForNoSourceFiles.ps1'), done);
        })
        it('(Get-SourceFilePaths) warns for source file not found', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SourceFilePaths.WarnsForSourceFileNotFound.ps1'), done);
        })
        it('(Get-SourceFilePaths) warns for source file not under root', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SourceFilePaths.WarnsForSourceFileNotUnderRoot.ps1'), done);
        })
        it('(Get-SourceProvider) returns tfs git provider', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SourceProvider.ReturnsTfsGitProvider.ps1'), done);
        })
        it('(Get-SourceProvider) warns for unsupported provider', (done) => {
            psm.runPS(path.join(__dirname, 'Get-SourceProvider.WarnsForUnsupportedProvider.ps1'), done);
        })
        it('(Invoke-DisposeSourceProvider) disposes collection', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-DisposeSourceProvider.DisposesCollection.ps1'), done);
        })
        it('(Invoke-DisposeSourceProvider) skips null collection', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-DisposeSourceProvider.SkipsNullCollection.ps1'), done);
        })
        it('(Invoke-IndexSources) multiple files', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-IndexSources.MultipleFiles.ps1'), done);
        })
        it('(Invoke-IndexSources) return if source provider is null', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-IndexSources.ReturnIfSourceProviderIsNull.ps1'), done);
        })
        it('(Invoke-IndexSources) throws if pdbstr exe not found', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-IndexSources.ThrowsIfPdbstrExeNotFound.ps1'), done);
        })
        it('(Invoke-IndexSources) warns if no symbols files', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-IndexSources.WarnsIfNoSymbolsFiles.ps1'), done);
        })
        it('(Invoke-IndexSources) warns if tmp contains space', (done) => {
            psm.runPS(path.join(__dirname, 'Invoke-IndexSources.WarnsIfTmpContainsSpace.ps1'), done);
        })
        it('(New-SrcSrvIniContent) returns tfs git content', (done) => {
            psm.runPS(path.join(__dirname, 'New-SrcSrvIniContent.ReturnsTfsGitContent.ps1'), done);
        })
        it('(New-SrcSrvIniContent) returns tfvc content', (done) => {
            psm.runPS(path.join(__dirname, 'New-SrcSrvIniContent.ReturnsTfvcContent.ps1'), done);
        })
        it('(New-TfsGitSrcSrvIniContent) formats content', (done) => {
            psm.runPS(path.join(__dirname, 'New-TfsGitSrcSrvIniContent.FormatsContent.ps1'), done);
        })
        it('(New-TfvcSrcSrvIniContent) formats content', (done) => {
            psm.runPS(path.join(__dirname, 'New-TfvcSrcSrvIniContent.FormatsContent.ps1'), done);
        })
        it('passes arguments', (done) => {
            psm.runPS(path.join(__dirname, 'PassesArguments.ps1'), done);
        })
        it('sets default values', (done) => {
            psm.runPS(path.join(__dirname, 'SetsDefaultValues.ps1'), done);
        })
        it('sets fallback max wait time', (done) => {
            psm.runPS(path.join(__dirname, 'SetsFallbackMaxWaitTime.ps1'), done);
        })
    }
});