import Q = require('q');
import assert = require('assert');
var psm = require('../../../Tests/lib/psRunner');
import path = require('path');
var psr = null;

describe('ServiceFabricComposeDeploy Suite', function () {
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