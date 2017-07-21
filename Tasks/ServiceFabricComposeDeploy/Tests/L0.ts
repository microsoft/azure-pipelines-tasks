/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
var psm = require('../../../Tests/lib/psRunner');
import path = require('path');
var psr = null;

describe('ServiceFabricComposeDeploy Suite', function () {
    this.timeout(20000);

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
        it('Deploy', (done) => {
            psr.run(path.join(__dirname, 'Deploy.ps1'), done);
        })
        it('Deploy Preview', (done) => {
            psr.run(path.join(__dirname, 'DeployPreview.ps1'), done);
        })
        it('Upgrade', (done) => {
            psr.run(path.join(__dirname, 'Upgrade.ps1'), done);
        })
        it('Upgrade Preview', (done) => {
            psr.run(path.join(__dirname, 'UpgradePreview.ps1'), done);
        })
    }
});