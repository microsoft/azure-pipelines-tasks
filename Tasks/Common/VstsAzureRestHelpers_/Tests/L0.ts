import Q = require('q');
import assert = require('assert');
import path = require('path');
var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

describe('Common-VstsAzureRestHelpers_ Suite', function () {
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
            psr.run(path.join(__dirname, 'Populate-AzureStackDependencyDataTest.ps1'), done);
        })
        it('Verify if Get-AzureActiveDirectoryResourceId returns correct URL.', (done) => {
            psr.run(path.join(__dirname, 'Get-AzureActiveDirectoryResourceIdTest.ps1'), done);
        })
        it('Get-AzureRMAccessToken should return access token', (done) => {
            psr.run(path.join(__dirname, 'Get-AzureRMAccessTokenForMSITest.ps1'), done);
        })
        it('Get-SpnAccessTokenUsingCertificate should return access token', (done) => {
            psr.run(path.join(__dirname, 'Get-SpnAccessTokenUsingCertificateTest.ps1'), done);
        });
        it('Get-AzureRmAccessToken should return access token based on endpoint parameters', (done) => {
        	psr.run(path.join(__dirname, 'Get-AzureRmAccessTokenTest.ps1'), done);
        });
        it('ConvertTo-Pfx should execute openssl.exe command and return pfx file path and password', (done) => {
        	psr.run(path.join(__dirname, 'ConvertTo-PfxTest.ps1'), done);
        });
    }
});