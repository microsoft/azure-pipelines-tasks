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

describe('MSBuild Suite', function () {
    this.timeout(10000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        it('(VsTest-NoTestAssemblies) throws if no test assemblies provided as input', (done) => {
            psm.runPS(path.join(__dirname, 'VsTest.ThrowsIfAssembliesNotProvided.ps1'), done);
        })
        it('(VsTest-NoSourceDiretory) throws if no source directory is found', (done) => {
            psm.runPS(path.join(__dirname, 'VsTest.ThrowsIfNoSourceDirectoryFound.ps1'), done);
        })
    }
});