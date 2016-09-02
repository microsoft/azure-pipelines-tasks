/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
var psr = null;

describe('Common-SonarQubeHelpers Suite', function () {
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
        it('InvokeRestApi tests', (done) => {
            psr.run(path.join(__dirname, 'InvokeRestApi.ps1'), done);
        })
        it('IsPRBuild tests', (done) => {
            psr.run(path.join(__dirname, 'IsPRBuild.ps1'), done);
        })
        it('ServerVersion tests', (done) => {
            psr.run(path.join(__dirname, 'ServerVersion.ps1'), done);
        })
    }
});