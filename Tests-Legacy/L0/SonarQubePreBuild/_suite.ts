/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
var psr = null;

describe('SonarQubePreBuild Suite', function () {
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
        it('CreateCommandLineArgs tests', (done) => {
            psr.run(path.join(__dirname, 'CreateCommandLineArgs.ps1'), done);
        })
        it('UpdateArgsForPrAnalysis tests', (done) => {
            psr.run(path.join(__dirname, 'UpdateArgsForPrAnalysis.ps1'), done);
        })
        it('DisableAnalysisOnPrBuild tests', (done) => {
            psr.run(path.join(__dirname, 'DisableAnalysisOnPrBuild.ps1'), done);
        })
    }
});