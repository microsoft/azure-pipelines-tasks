import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';
import { MysqlClient } from '../sql/MysqlClient';
import { FirewallConfiguration } from '../models/FirewallConfiguration';

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

    it('AzureMySqlDeployment FirewallOperationTests', (done: MochaDone) => {
        let tp = path.join(__dirname, 'FirewallOperationTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('FirewallOperationsL0Tests.addFirewallRuleTest should have succeeded.'), 'Should have printed: FirewallOperationsL0Tests.addFirewallRuleTest should have succeeded.');
            assert(tr.stdOutContained('FirewallOperationsL0Tests.deleteFirewallRuleTest should have succeeded.'), 'Should have printed: FirewallOperationsL0Tests.deleteFirewallRuleTest should have succeeded.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

    it('AzureMySqlDeployment ToolPathOperationTests', (done: MochaDone) => {
        let tp = path.join(__dirname, 'ToolPathOperationTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should has passed.'), 'Should have printed: ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should has passed.');
            done();
        }
        catch(error) {
            done(error);
        }
    });
    
    it('AzureMySqlDeployment MysqlClient', (done: MochaDone) => {
        let tp = path.join(__dirname, 'MysqlClientTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('MysqlClientL0Tests.getFirewallConfiguration should has passed.'), 'Should have printed: MysqlClientL0Tests.getFirewallConfiguration should has passed.');
            assert(tr.stdOutContained('MysqlClientL0Tests.executeSqlCommand should has passed'), 'Should have printed: MysqlClientL0Tests.executeSqlCommand should has passed.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

});
