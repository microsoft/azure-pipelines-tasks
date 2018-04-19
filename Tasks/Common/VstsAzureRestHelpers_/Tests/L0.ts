/// <reference path="../../../../definitions/mocha.d.ts"/>
/// <reference path="../../../../definitions/node.d.ts"/>
/// <reference path="../../../../definitions/Q.d.ts"/>

import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

describe('Common-VstsAzureHelpers_ Suite', function () {
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
        it('Add-AzureStackDependencyData to populate Azure Stack endpoint data.', (done) => {
            psr.run(path.join(__dirname, 'Populate-AzureStackDependencyData.ps1'), done);
        })
        it('Verify if Get-AzureActiveDirectoryResourceId returns correct URL.', (done) => {
            psr.run(path.join(__dirname, 'Get-AzureActiveDirectoryResourceId.ps1'), done);
        })
        it('Get-AzureRMAccessToken should return access token', (done) => {
            psr.run(path.join(__dirname, 'Get-AzureRMAccessToken.ps1'), done);
        })
    }
});