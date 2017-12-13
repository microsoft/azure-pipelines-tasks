/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
var psm = require('../../../Tests/lib/psRunner');
import path = require('path');
var psr = null;

describe('ServiceFabricDeploy Suite', function () {
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
        it('AAD deploy', (done) => {
            psr.run(path.join(__dirname, 'AadDeploy.ps1'), done);
        })
        it('Certificate deploy', (done) => {
            psr.run(path.join(__dirname, 'CertDeploy.ps1'), done);
        })
        it('No auth deploy', (done) => {
            psr.run(path.join(__dirname, 'NoAuthDeploy.ps1'), done);
        })
        it('Windows auth deploy', (done) => {
            psr.run(path.join(__dirname, 'WindowsAuthDeploy.ps1'), done);
        })
        it('Certificate deploy with Docker support', (done) => {
            psr.run(path.join(__dirname, 'CertDeployWithDocker.ps1'), done);
        })
    }
});