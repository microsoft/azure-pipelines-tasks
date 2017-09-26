import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import tl = require('vsts-task-lib');
import * as path from 'path';

describe('PyPI Publisher', function () {
    
    before(() => {
        //Enable this for output
        //process.env['TASK_TEST_TRACE'] = 1; 

        //setup endpoint
        process.env["ENDPOINT_AUTH_MyTestEndpoint"] = "{\"parameters\":{\"username\":\"uname\", \"password\":\"password\"},\"scheme\":\"usernamepassword\"}";
        process.env["ENDPOINT_URL_MyTestEndpoint"] = "https://example.test/v0.1";
        process.env["ENDPOINT_AUTH_PARAMETER_MyTestEndpoint_USERNAME"] = "username";
        process.env["ENDPOINT_AUTH_PARAMETER_MyTestEndpoint_PASSWORD"] = "password";
    });

    after(() => {

    });
    
    it('Python tool should be present', (done: MochaDone) => {
        this.timeout(2000);

        let tp = path.join(__dirname, 'L0PythonAvailability.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        tr.run();
        //console.log(tr.stderr, tr.stdout);
        assert(tr.succeeded, 'task should have succeeded');
        
        done();
    });
});