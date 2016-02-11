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

describe('MSBuild Suite', function () {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    if (ps) {
        it('passes arguments', (done) => {
            psm.runPS(path.join(__dirname, 'PassesArguments.ps1'), done);
        })
    }
});