import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
import * as path from 'path';

describe('AzureMySqlDeployment Suite', function() {

    this.timeout(60000);

    it('AzureMySqlDeployment MysqlServerOperationsL0Tests', (done: MochaDone) => {
        let tp = path.join(__dirname, 'MysqlServerOperationsL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should has passed.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should has passed.');
            assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to without id in mysql server.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to without id in mysql server.');
            assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid id in mysql server.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid id in mysql server.');
            assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid mysql server name.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid mysql server name.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureMySqlDeployment FirewallOperationsLoTests', (done: MochaDone) => {
        let tp = path.join(__dirname, 'FirewallOperationsL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            console.log(tr.stdout);
            console.log(tr.stderr);
            done();
        }
        catch(error) {
            done(error);
        }
    });


});
