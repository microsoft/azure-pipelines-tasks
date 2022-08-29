import Q = require('q');
import assert = require('assert');
var path = require('path');
var psm = require('../../../Tests/lib/psRunner');
var psr = null;

describe('IISWebAppManagementOnMachineGroup Suite', function () {
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