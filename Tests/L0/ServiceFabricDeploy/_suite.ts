/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import trm = require('../../lib/taskRunner');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
var psr = null;

describe('ServiceFabricDeploy Suite', function () {
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
        it('AAD deploy', (done) => {
            psr.run(path.join(__dirname, 'AadDeploy.ps1'), done);
        })
        it('Certificate deploy', (done) => {
            psr.run(path.join(__dirname, 'CertDeploy.ps1'), done);
        })
        it('No auth deploy', (done) => {
            psr.run(path.join(__dirname, 'NoAuthDeploy.ps1'), done);
        })
    }
});