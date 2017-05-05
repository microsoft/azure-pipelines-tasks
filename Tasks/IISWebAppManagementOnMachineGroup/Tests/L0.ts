/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>
/// <reference path="../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
var path = require('path');
var psm = require('../../../Tests/lib/psRunner');
var shell = require('shelljs');
var ps = shell.which('powershell.exe');
var psr = null;

describe('IISWebAppManagementOnMachineGroup Suite', function () {
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
        it('test iis manage utility - manage website', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityManageWebsite.ps1'), done);
        }) 

        it('test iis manage utility - manage application', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityManageApp.ps1'), done);
        })

        it('test iis manage utility - manage virtual directory', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityManageVDir.ps1'), done);
        }) 
        
        it('test iis manage utility - manage application pool', (done) => {
            psr.run(path.join(__dirname, 'L0UtilityManageAppPool.ps1'), done);
        }) 
    }    
});