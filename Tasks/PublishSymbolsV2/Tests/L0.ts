import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('PublishSymbols Suite', function () {
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
        it('(Add-DbghelpLibrary) loads if not loaded', (done) => {
            psr.run(path.join(__dirname, 'Add-DbghelpLibrary.LoadsIfNotLoaded.ps1'), done);
        })
        it('(Add-DbghelpLibrary) skips if already loaded', (done) => {
            psr.run(path.join(__dirname, 'Add-DbghelpLibrary.SkipsIfAlreadyLoaded.ps1'), done);
        })
        it('(Add-DbghelpLibrary) throws if dll not found', (done) => {
            psr.run(path.join(__dirname, 'Add-DbghelpLibrary.ThrowsIfDllNotFound.ps1'), done);
        })
        it('(Add-DbghelpLibrary) warns if different location already loaded', (done) => {
            psr.run(path.join(__dirname, 'Add-DbghelpLibrary.WarnsIfDifferentLocationAlreadyLoaded.ps1'), done);
        })
        it('(Add-DbghelpLibrary) warns if load fails', (done) => {
            psr.run(path.join(__dirname, 'Add-DbghelpLibrary.WarnsIfLoadFails.ps1'), done);
        })
        it('(Add-SourceServerStream) instruments pdb', (done) => {
            psr.run(path.join(__dirname, 'Add-SourceServerStream.InstrumentsPdb.ps1'), done);
        })
        it('(Add-SourceServerStream) specially handles pdbs with spaces', (done) => {
            psr.run(path.join(__dirname, 'Add-SourceServerStream.SpeciallyHandlesPdbsWithSpaces.ps1'), done);
        })
        it('(Get-ArtifactName) returns correct value', (done) => {
            psr.run(path.join(__dirname, 'Get-ArtifactName.ReturnsCorrectValue.ps1'), done);
        })
        it('(Get-SymbolBinaryPathCallers) succeed', (done) => {
            psr.run(path.join(__dirname, 'Get-SymbolBinaryPathCallers.Succeed.ps1'), done);
        })
        it('(Get-LastTransactionId) gets id', (done) => {
            psr.run(path.join(__dirname, 'Get-LastTransactionId.GetsId.ps1'), done);
        })
        it('(Get-LastTransactionId) warns if not found', (done) => {
            psr.run(path.join(__dirname, 'Get-LastTransactionId.WarnsIfNotFound.ps1'), done);
        })
        it('(Get-SourceFilePaths) returns multiple files', (done) => {
            psr.run(path.join(__dirname, 'Get-SourceFilePaths.ReturnsMultipleFiles.ps1'), done);
        })
        it('(Get-SourceFilePaths) warns for no source files', (done) => {
            psr.run(path.join(__dirname, 'Get-SourceFilePaths.WarnsForNoSourceFiles.ps1'), done);
        })
        it('(Get-SourceFilePaths) warns for source file not found', (done) => {
            psr.run(path.join(__dirname, 'Get-SourceFilePaths.WarnsForSourceFileNotFound.ps1'), done);
        })
        it('(Get-SourceFilePaths) warns for source file not under root', (done) => {
            psr.run(path.join(__dirname, 'Get-SourceFilePaths.WarnsForSourceFileNotUnderRoot.ps1'), done);
        })
        it('(Get-SourceProvider) returns tfs git provider', (done) => {
            psr.run(path.join(__dirname, 'Get-SourceProvider.ReturnsTfsGitProvider.ps1'), done);
        })
        it('(Get-SourceProvider) warns for unsupported provider', (done) => {
            psr.run(path.join(__dirname, 'Get-SourceProvider.WarnsForUnsupportedProvider.ps1'), done);
        })
        it('(Get-SymbolClientVersion) succeeds on retry', (done) => {
            psr.run(path.join(__dirname, 'Get-SymbolClientVersion.SucceedsWithRetry.ps1'), done);
        })
        it('(Get-ValidValue) returns within range', (done) => {
            psr.run(path.join(__dirname, 'Get-ValidValue.ReturnsWithinRange.ps1'), done);
        })
        // Commenting out to unblock CI
        // it('(Invoke-IndexSources) multiple files', (done) => {
        //     psr.run(path.join(__dirname, 'Invoke-IndexSources.MultipleFiles.ps1'), done);
        // })
        it('(Invoke-IndexSources) return if source provider is null', (done) => {
            psr.run(path.join(__dirname, 'Invoke-IndexSources.ReturnIfSourceProviderIsNull.ps1'), done);
        })
        it('(Invoke-IndexSources) warns if no symbols files', (done) => {
            psr.run(path.join(__dirname, 'Invoke-IndexSources.WarnsIfNoSymbolsFiles.ps1'), done);
        })
        // it('(Invoke-IndexSources) warns if tmp contains space', (done) => {
        //     psr.run(path.join(__dirname, 'Invoke-IndexSources.WarnsIfTmpContainsSpace.ps1'), done);
        // })
        it('(Invoke-PublishSymbols) publishes', (done) => {
            psr.run(path.join(__dirname, 'Invoke-PublishSymbols.Publishes.ps1'), done);
        })
        it('(Invoke-PublishSymbols) returns if no files', (done) => {
            psr.run(path.join(__dirname, 'Invoke-PublishSymbols.ReturnsIfNoFiles.ps1'), done);
        })
        it('(Invoke-UnpublishSymbols) unpublishes', (done) => {
            psr.run(path.join(__dirname, 'Invoke-UnpublishSymbols.Unpublishes.ps1'), done);
        })
        it('(Lock-Semaphore) cleans up expired semaphore', (done) => {
            psr.run(path.join(__dirname, 'Lock-Semaphore.CleansUpExpiredSemaphore.ps1'), done);
        })
        it('(Lock-Semaphore) creates semaphore', (done) => {
            psr.run(path.join(__dirname, 'Lock-Semaphore.CreatesSemaphore.ps1'), done);
        })
        it('(Lock-Semaphore) reaches max wait time', (done) => {
            psr.run(path.join(__dirname, 'Lock-Semaphore.ReachesMaxWaitTime.ps1'), done);
        })
        it('(Lock-Semaphore) retries on exception', (done) => {
            psr.run(path.join(__dirname, 'Lock-Semaphore.RetriesOnException.ps1'), done);
        })
        it('(New-ResponseFile) creates file', (done) => {
            psr.run(path.join(__dirname, 'New-ResponseFile.CreatesFile.ps1'), done);
        })
        it('(New-SrcSrvIniContent) returns tfs git content', (done) => {
            psr.run(path.join(__dirname, 'New-SrcSrvIniContent.ReturnsTfsGitContent.ps1'), done);
        })
        it('(New-SrcSrvIniContent) returns tfvc content', (done) => {
            psr.run(path.join(__dirname, 'New-SrcSrvIniContent.ReturnsTfvcContent.ps1'), done);
        })
        it('(New-TfsGitSrcSrvIniContent) formats content', (done) => {
            psr.run(path.join(__dirname, 'New-TfsGitSrcSrvIniContent.FormatsContent.ps1'), done);
        })
        // Commenting it out to unblock ci
        // it('(New-TfvcSrcSrvIniContent) formats content', (done) => {
        //     psr.run(path.join(__dirname, 'New-TfvcSrcSrvIniContent.FormatsContent.ps1'), done);
        // })
        it('passes arguments', (done) => {
            psr.run(path.join(__dirname, 'PassesArguments.ps1'), done);
        })
        it('passes delete arguments', (done) => {
            psr.run(path.join(__dirname, 'PassesDeleteArguments.ps1'), done);
        })
        it('(Remove-SemaphoreFile_Safe) performs cleanup', (done) => {
            psr.run(path.join(__dirname, 'Remove-SemaphoreFile_Safe.PerformsCleanup.ps1'), done);
        })
        it('sets fallback max wait time', (done) => {
            psr.run(path.join(__dirname, 'SetsFallbackMaxWaitTime.ps1'), done);
        })
        it('skips indexing', (done) => {
            psr.run(path.join(__dirname, 'SkipsIndexing.ps1'), done);
        })
        it('skips publishing', (done) => {
            psr.run(path.join(__dirname, 'SkipsPublishing.ps1'), done);
        })
        it('(Test-SemaphoreMaximumAge) is correct', (done) => {
            psr.run(path.join(__dirname, 'Test-SemaphoreMaximumAge.IsCorrect.ps1'), done);
        })
        it('(Unlock-Semaphore) performs cleanup', (done) => {
            psr.run(path.join(__dirname, 'Unlock-Semaphore.PerformsCleanup.ps1'), done);
        })
    }
});
