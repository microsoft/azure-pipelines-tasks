/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
/// <reference path="../../definitions/Q.d.ts"/>

import Q = require('q');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
var psr = null;

describe('SonarQubePostTest Suite', function () {
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
         it('DisableAnalysisOnPrBuild tests', (done) => {
             psr.run(path.join(__dirname, 'DisableAnalysisOnPrBuild.ps1'), done);
         })
         it('TopLevelOrchestration tests', (done) => {
             psr.run(path.join(__dirname, 'TopLevelOrchestration.ps1'), done);
         })
         it('PRCA Report Processor tests', (done) => {
             psr.run(path.join(__dirname, 'PRCA', 'ReportProcessorTests.ps1'), done);
         })
         it('PRCA Post Comments tests', (done) => {
             psr.run(path.join(__dirname, 'PRCA', 'PostCommentsTests.ps1'), done);
         })
         it('PRCA Orchestrator tests', (done) => {
             psr.run(path.join(__dirname, 'PRCA', 'OrchestratorTests.ps1'), done);
         })
         it('PRCA Invoke tests', (done) => {
            psr.run(path.join(__dirname,'PRCA', 'InvokeTests.ps1'), done);
         })
         it('SonarQubeMetrics tests', (done) => {
             psr.run(path.join(__dirname, 'SonarQubeMetrics.ps1'), done);
         })
         it('SummaryReport tests', (done) => {
            psr.run(path.join(__dirname, 'SummaryReport.ps1'), done);
         })
    }
});