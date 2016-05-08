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
var psr = null;

describe('AzurePowerShell Suite', function () {
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
        it('does not unravel output', (done) => {
            psr.run(path.join(__dirname, 'DoesNotUnravelOutput.ps1'), done);
        })
        it('performs basic flow', (done) => {
            psr.run(path.join(__dirname, 'PerformsBasicFlow.ps1'), done);
        })
        it('redirects errors', (done) => {
            psr.run(path.join(__dirname, 'RedirectsErrors.ps1'), done);
        })
        it('removes functions and variables', (done) => {
            psr.run(path.join(__dirname, 'RemovesFunctionsAndVariables.ps1'), done);
        })
        it('throws when invalid script arguments', (done) => {
            psr.run(path.join(__dirname, 'ThrowsWhenInvalidScriptArguments.ps1'), done);
        })
        it('throws when invalid script path', (done) => {
            psr.run(path.join(__dirname, 'ThrowsWhenInvalidScriptPath.ps1'), done);
        })
    }
});