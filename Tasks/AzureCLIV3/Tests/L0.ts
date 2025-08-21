import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AzureCLIV3 Suite', function () {
    const timeout = 20000;

    before(() => {
    });

    after(() => {
    });

    it('Should handle Azure DevOps connection with Workload Identity Federation', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsWifConnection.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            
            assert(tr.stdout.includes('az --version'), 'Should execute az --version command');
            assert(tr.stdout.includes('az extension add -n azure-devops'), 'Should install Azure DevOps extension');
            assert(tr.stdout.includes('az login --service-principal'), 'Should login with service principal');
            assert(tr.stdout.includes('az devops configure --defaults organization'), 'Should configure Azure DevOps organization');
            assert(tr.stdout.includes('az devops configure --defaults project'), 'Should configure Azure DevOps project');
            
            assert(tr.stdout.indexOf('Azure DevOps CLI extension installed') >= 0, 'should install Azure DevOps extension');
            assert(tr.stdout.indexOf('organization configured') >= 0, 'should configure organization');
            assert(tr.stdout.indexOf('project configured') >= 0, 'should configure project');
            done();
        }).catch((err) => {
            done(err);
        });
    });

    it('Should fail with unsupported authentication scheme for Azure DevOps', function (done) {
        this.timeout(timeout);

        let tp = path.join(__dirname, 'L0AzureDevOpsUnsupportedAuthScheme.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.runAsync().then(() => {
            assert(tr.failed, 'should have failed');
            assert(tr.stdout.indexOf('loc_mock_AuthSchemeNotSupported ServicePrincipal') >= 0, 'Should have failed with unsupported auth scheme error');
            done();
        }).catch((err) => {
            done(err);
        });
    });

});
