/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
var psr = null;

describe('ServiceFabricUpdateAppVersions Suite', function () {
    this.timeout(20000);

    before((done) => {
        if (ps) {
            psr = new psm.PSRunner();
            psr.start();
        }

        done();
    });

    after(function () {
        psr.kill();
    });

    if (ps) {
        it('update all versions', (done) => {
            psr.run(path.join(__dirname, 'SimpleSuffix.ps1'), done);
        })
        it('(Update-ApplicationVersions) no changes', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.NoChanges.ps1'), done);
        })
        it('(Update-ApplicationVersions) service changed', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.ServiceChanged.ps1'), done);
        })
        it('(Update-ApplicationVersions) app manifest xml changed', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.XmlChanged.ps1'), done);
        })
        it('(Update-ApplicationVersions) app version prefix changed', (done) => {
            psr.run(path.join(__dirname, 'Update-ApplicationVersions.VersionPrefixChanged.ps1'), done);
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
    }
});