/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import fs = require('fs');
var psm = require('../../../Tests/lib/psRunner');
import path = require('path');
var psr = null;

describe('ServiceFabricComposeDeploy Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    it('packages the shared output modes without changing the default', () => {
        const packaged = fs.readFileSync(path.join(__dirname, '../ps_modules/ExternalOutputSanitizer/ExternalOutputSanitizer.ps1'), 'utf8');
        const shared = fs.readFileSync(path.join(__dirname, '../../Common/ExternalOutputSanitizer/ExternalOutputSanitizer.ps1'), 'utf8');
        assert.strictEqual(packaged, shared);
        assert(packaged.includes("[string] $VsoCommandMode = 'blockOnly'"));
    });

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
        it('formats filename diagnostics without changing paths', done => {
            psr.run(path.join(__dirname, 'FilenameDiagnostics.ps1'), done);
        });
        it('Deploy 2.7', (done) => {
            psr.run(path.join(__dirname, 'Deploy.2.7.ps1'), done);
        })
        it('Deploy 2.8', (done) => {
            psr.run(path.join(__dirname, 'Deploy.2.8.ps1'), done);
        })
        it('Deploy Preview', (done) => {
            psr.run(path.join(__dirname, 'DeployPreview.ps1'), done);
        })
        it('Replace 2.8', (done) => {
            psr.run(path.join(__dirname, 'Replace.2.8.ps1'), done);
        })
        it('Upgrade 2.7', (done) => {
            psr.run(path.join(__dirname, 'Upgrade.2.7.ps1'), done);
        })
        it('Upgrade 2.8', (done) => {
            psr.run(path.join(__dirname, 'Upgrade.2.8.ps1'), done);
        })
        it('Upgrade Preview', (done) => {
            psr.run(path.join(__dirname, 'UpgradePreview.ps1'), done);
        })
    }
});