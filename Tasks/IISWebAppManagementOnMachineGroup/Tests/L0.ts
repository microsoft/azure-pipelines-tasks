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

        it('test website exists', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdTestWebsiteExists.ps1'), done);
        }) 

        it('test add and update website', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdAddUpdateWebsite.ps1'), done);
        }) 
  		
  		it('test add binding for website', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdTestBinding.ps1'), done);
        })

        it('test sni and sslcert addition for https binding', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdTestSSLandSNI.ps1'), done);
        })

        it('test application pool exists', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdTestApplicationPoolExists.ps1'), done);
        })

        it('test add and update appPool', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdAddUpdateAppPool.ps1'), done);
        }) 

        it('test application exists', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdTestApplicationExists.ps1'), done);
        })

        it('test add and update application', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdAddUpdateApplication.ps1'), done);
        })
     	
        it('test virtual directory exists', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdTestVirtualDirExists.ps1'), done);
        }) 

        it('test add and update virtual directory', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdAddUpdateVDir.ps1'), done);
        })

        it('test additional actions for website and application pool', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdAdditionalActions.ps1'), done);
        }) 

        it('test execute main for appcmd', (done) => {
            psr.run(path.join(__dirname, 'L0AppcmdExecuteMain.ps1'), done);
        }) 

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