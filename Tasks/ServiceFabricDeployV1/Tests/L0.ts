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
        it('Certificate deploy with Docker support and multiple Thumbprints', (done) => {
            psr.run(path.join(__dirname, 'CertDeployWithDockerMultiThumbprint.ps1'), done);
        })
        it('Deploy with diff pkg', (done) => {
            psr.run(path.join(__dirname, 'CreateDiffPkg.ps1'), done);
        })
        it('Copy application package should retry', (done) => {
            psr.run(path.join(__dirname, 'CopyApplicationPackageShouldRetry.ps1'), done);
        })
        it('Copy application package should retry till success', (done) => {
            psr.run(path.join(__dirname, 'CopyApplicationPackageShouldRetryTillSuccess.ps1'), done);
        })
        it('Get appliction type should retry till success', (done) => {
            psr.run(path.join(__dirname, 'GetApplicationTypeShouldRetryTillSuccess.ps1'), done);
        })
        it('Register application type should retry till success', (done) => {
            psr.run(path.join(__dirname, 'RegisterApplicationTypeShouldRetryTillSuccess.ps1'), done);
        })
        it('Register application type should retry', (done) => {
            psr.run(path.join(__dirname, 'RegisterApplicationTypeShouldRetry.ps1'), done);
        })
        it('Unregister application type should retry till success', (done) => {
            psr.run(path.join(__dirname, 'UnregisterApplicationTypeShouldRetryTillSuccess.ps1'), done);
        })
        it('Unregister application type should retry', (done) => {
            psr.run(path.join(__dirname, 'UnregisterApplicationTypeShouldRetry.ps1'), done);
        })
        it('Create application type should retry till success', (done) => {
            psr.run(path.join(__dirname, 'CreateApplicationShouldRetryTillSuccess.ps1'), done);
        })
        it('Create application type should retry', (done) => {
            psr.run(path.join(__dirname, 'CreateApplicationShouldRetry.ps1'), done);
        })
        it('Remove application type should retry till success', (done) => {
            psr.run(path.join(__dirname, 'RemoveApplicationShouldRetryTillSuccess.ps1'), done);
        })
        it('Remove application type should retry', (done) => {
            psr.run(path.join(__dirname, 'RemoveApplicationShouldRetry.ps1'), done);
        })
        it('Start application upgrade should retry till success', (done) => {
            psr.run(path.join(__dirname, 'StartApplicationUpgradeShouldRetryTillSuccess.ps1'), done);
        })
        it('Start application upgrade should retry', (done) => {
            psr.run(path.join(__dirname, 'StartApplicationUpgradeShouldRetry.ps1'), done);
        })
    }
});