import * as assert from 'assert';
import * as path from 'path';

import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('AzureMySqlDeployment Suite', function() {
    this.timeout(60000);

    it('AzureMySqlDeployment MysqlServerOperationsL0Tests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'MysqlServerOperationsL0Tests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should has passed.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should has passed.');
        assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to without id in mysql server.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to without id in mysql server.');
        assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid id in mysql server.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid id in mysql server.');
        assert(tr.stdOutContained('MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid mysql server name.') , 'Should have printed: MysqlServerOperationsTests.MysqlServerFromServerName should have failed due to invalid mysql server name.');
    });

    it('AzureMySqlDeployment FirewallOperationTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'FirewallOperationTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('FirewallOperationsL0Tests.addFirewallRuleTest should have succeeded.'), 'Should have printed: FirewallOperationsL0Tests.addFirewallRuleTest should have succeeded.');
        assert(tr.stdOutContained('FirewallOperationsL0Tests.deleteFirewallRuleTest should have succeeded.'), 'Should have printed: FirewallOperationsL0Tests.deleteFirewallRuleTest should have succeeded.');
    });

    it('AzureMySqlDeployment ToolPathOperationTests', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'ToolPathOperationTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should has passed.'), 'Should have printed: ToolPathOperationsL0Tests.getInstalledPathOfMysqlForLinux should has passed.');
    });

    it('AzureMySqlDeployment MysqlClient', async () => {
        const tr = new ttm.MockTestRunner(path.join(__dirname, 'MysqlClientTests.js'));
        await tr.runAsync();

        assert(tr.stdOutContained('MysqlClientL0Tests.get should has passed.'), 'Should have printed: MysqlClientL0Tests.get should has passed.');
        assert(tr.stdOutContained('MysqlClientL0Tests.executeSqlCommand should has passed'), 'Should have printed: MysqlClientL0Tests.executeSqlCommand should has passed.');
    });
});
