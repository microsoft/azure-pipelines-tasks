/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
var psm = require('../../../Tests/lib/psRunner');
import path = require('path');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
var psr = null;

describe('ServiceFabricComposeDeploy Suite', function () {
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
        it('Deploy', (done) => {
            psr.run(path.join(__dirname, 'Deploy.ps1'), done);
        })
        it('Upgrade', (done) => {
            psr.run(path.join(__dirname, 'Upgrade.ps1'), done);
        })
    }
});