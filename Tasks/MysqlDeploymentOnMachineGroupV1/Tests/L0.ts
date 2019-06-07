import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';
import tmrm = require('azure-pipelines-task-lib/mock-run');
import tl = require('azure-pipelines-task-lib');
import * as path from 'path';
import { MysqlClient } from '../sql/MysqlClient';

describe('MySqlDeployment Suite', function() {

    this.timeout(60000);

    it('MySqlDeployment ToolPathOperationTests', (done: MochaDone) => {
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
    
    it('MySqlDeployment MysqlClient', (done: MochaDone) => {
        let tp = path.join(__dirname, 'MysqlClientTests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        try {
            tr.run();
            assert(tr.stdOutContained('MysqlClientL0Tests.executeSqlCommand should has passed'), 'Should have printed: MysqlClientL0Tests.executeSqlCommand should has passed.');
            done();
        }
        catch(error) {
            done(error);
        }
    });

});
