import Q = require('q');
import assert = require('assert');
var psm = require('../../../Tests/lib/psRunner');
import path = require('path');
var psr = null;

describe('ServiceFabricUpdateManifests Suite', function () {
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
        it('update all versions', (done) => {
            psr.run(path.join(__dirname, 'SimpleSuffix.ps1'), done);
        })
        it('(Update-ApplicationVersions) no changes', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.NoChanges.ps1'), done);
        })
        it('(Update-ApplicationVersions) no changes (package in sub path)', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.NoChanges.SubPath.ps1'), done);
        })
        it('(Update-ApplicationVersions) service changed', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.ServiceChanged.ps1'), done);
        })
        it('(Update-ApplicationVersions) service changed (package in sub path)', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.ServiceChanged.SubPath.ps1'), done);
        })
        it('(Update-ApplicationVersions) app manifest xml changed', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.XmlChanged.ps1'), done);
        })
        it('(Update-ApplicationVersions) app version prefix changed', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.VersionPrefixChanged.ps1'), done);
        })
        it('(Update-ApplicationVersions) old app manifest not found', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.OldManifestNotFound.ps1'), done);
        })
        it('(Update-ServiceVersions) no changes', (done) => {
            psr.run(path.join(__dirname, 'Update-ServiceVersions.NoChanges.ps1'), done);
        })
        it('(Update-ServiceVersions) new service', (done) => {
            psr.run(path.join(__dirname, 'Update-ServiceVersions.NewService.ps1'), done);
        })
        it('(Update-ServiceVersions) package changed', (done) => {
            psr.run(path.join(__dirname, 'Update-ServiceVersions.PackageChanged.ps1'), done);
        })
        it('(Update-ServiceVersions) service manifest xml changed', (done) => {
            psr.run(path.join(__dirname, 'Update-ServiceVersions.XmlChanged.ps1'), done);
        })
        it('(Update-ServiceVersions) service version prefix changed', (done) => {
            psr.run(path.join(__dirname, 'Update-ServiceVersions.VersionPrefixChanged.ps1'), done);
        })
        it('(Update-PackageVersion) no changes', (done) => {
            psr.run(path.join(__dirname, 'Update-PackageVersion.NoChanges.ps1'), done);
        })
        it('(Update-PackageVersion) new package', (done) => {
            psr.run(path.join(__dirname, 'Update-PackageVersion.NewPackage.ps1'), done);
        })
        it('(Update-PackageVersion) files changed', (done) => {
            psr.run(path.join(__dirname, 'Update-PackageVersion.FilesChanged.ps1'), done);
        })
        it('(Update-PackageVersion) service manifest xml changed', (done) => {
            psr.run(path.join(__dirname, 'Update-PackageVersion.XmlChanged.ps1'), done);
        })
        it('(Update-PackageVersion) package version prefix changed', (done) => {
            psr.run(path.join(__dirname, 'Update-PackageVersion.VersionPrefixChanged.ps1'), done);
        })
        it('(Update-PackageVersion) code package folders from both old and new packages do not exist', (done) => {
            psr.run(path.join(__dirname, 'Update-PackageVersion.OldAndNewDoNotExist.ps1'), done);
        })
        it('(Update-PackageVersion) code package folder from old package does not exist', (done) => {
            psr.run(path.join(__dirname, 'Update-PackageVersion.OnlyNewExists.ps1'), done);
        })
        it('(Update-PackageVersion) code package folder from new package does not exist', (done) => {
            psr.run(path.join(__dirname, 'Update-PackageVersion.OnlyOldExists.ps1'), done);
        })
        it('(Find-FileChanges) no changes', (done) => {
            psr.run(path.join(__dirname, 'Find-FileChanges.NoChanges.ps1'), done);
        })
        it('(Find-FileChanges) file content changed', (done) => {
            psr.run(path.join(__dirname, 'Find-FileChanges.Changed.ps1'), done);
        })
        it('(Find-FileChanges) files were added', (done) => {
            psr.run(path.join(__dirname, 'Find-FileChanges.Added.ps1'), done);
        })
        it('(Find-FileChanges) files were removed', (done) => {
            psr.run(path.join(__dirname, 'Find-FileChanges.Removed.ps1'), done);
        })
        it('(Find-FileChanges) only the first change is logged', (done) => {
            psr.run(path.join(__dirname, 'Find-FileChanges.LogOnlyFirst.ps1'), done);
        })
        it('(Update-DockerImageSettings.psm1) test untagged Docker image settings with names file', done => {
            psr.run(path.join(__dirname, 'Test-UntaggedDockerImageSettingsWithNames.ps1'), done);
        })
        it('(Update-DockerImageSettings.psm1) test untagged Docker image settings without names file', done => {
            psr.run(path.join(__dirname, 'Test-UntaggedDockerImageSettingsWithoutNames.ps1'), done);
        })
        it('(Update-DockerImageSettings.psm1) test tagged Docker image settings with names file', done => {
            psr.run(path.join(__dirname, 'Test-TaggedDockerImageSettingsWithNames.ps1'), done);
        })
        it('(Update-DockerImageSettings.psm1) test Tagged Docker image settings without names file', done => {
            psr.run(path.join(__dirname, 'Test-TaggedDockerImageSettingsWithoutNames.ps1'), done);
        })
        it('(Update-DockerImageSettings.psm1) test ambiguous tagged Docker image settings with names file', done => {
            psr.run(path.join(__dirname, 'Test-AmbiguousTaggedDockerImageSettingsWithNames.ps1'), done);
        })
        it('(Update-DockerImageSettings.psm1) test ambiguous tagged Docker image settings without names file', done => {
            psr.run(path.join(__dirname, 'Test-AmbiguousTaggedDockerImageSettingsWithoutNames.ps1'), done);
        })
    }
});