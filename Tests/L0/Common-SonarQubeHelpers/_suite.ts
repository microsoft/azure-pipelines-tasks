/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import psm = require('../../lib/psRunner');
import path = require('path');
var shell = require('shelljs');
var ps = shell.which('powershell');

describe('Common-MSBuildHelpers Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        it('A tests', (done) => {
            psm.runPS(path.join(__dirname, 'InvokeRestApi.ps1'), done);
        })
       
    }
});