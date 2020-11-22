import fs = require('fs');
import assert = require('assert');
import * as ttm from 'vsts-task-lib/mock-test';
import path = require('path');
import tl = require('azure-pipelines-task-lib');
var ltx = require('ltx');

describe('FileTransformV1 Suite', function () {
    before(() => {
        // uncomment to enable test tracing
        // process.env['TASK_TEST_TRACE'] = 1; 
    })

    beforeEach(() => {
        // we need to do this every time, as some tests access / write to the same file
        tl.cp(path.join(__dirname, "..", "node_modules","webdeployment-common-v2","Tests", 'L1XdtTransform', 'Web.config'), path.join(__dirname, "..", "node_modules","webdeployment-common-v2","Tests", 'L1XdtTransform', 'Web_test.config'), '-f', false);
    });

    after(() => {
    });

    it('Does a basic hello world test', function(done: MochaDone) {
        // TODO - add real tests
        done();
    });

    if(tl.getPlatform() === tl.Platform.Windows) {
        var testSpecialXdtTransform = (fileName: string, done: MochaDone) => {
            this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

            let tp = path.join(__dirname, "..", "node_modules", "webdeployment-common-v2", "Tests", fileName);
            let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
            tr.run();

            var resultFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","webdeployment-common-v2","Tests", 'L1XdtTransform', 'Web_test.config')));
            var expectFile = ltx.parse(fs.readFileSync(path.join(__dirname, "..", "node_modules","webdeployment-common-v2","Tests", 'L1XdtTransform','Web_Expected.config')));
            assert(ltx.equal(resultFile, expectFile) , 'Should Transform attributes on Web.config');
            done();
        };

        it('Runs successfully with XML Transformation on relative paths (L1)', (done:MochaDone) => {
            testSpecialXdtTransform('L1SpecialXdtTransformRelative.js', done);
        });

        it('Runs successfully with XML Transformation on absolute paths (L1)', (done:MochaDone) => {
            testSpecialXdtTransform('L1SpecialXdtTransformAbsolute.js', done);
        });
    }
});
