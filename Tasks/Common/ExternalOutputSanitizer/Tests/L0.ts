/// <reference path="../../../../definitions/mocha.d.ts"/>
/// <reference path="../../../../definitions/node.d.ts"/>

import path = require('path');

var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

describe('External Output Sanitizer Suite', function () {
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
        it('Protect-ExternalOutput neutralizes untrusted logging command markers', (done) => {
            psr.run(path.join(__dirname, 'L0Protect-ExternalOutput.ps1'), done);
        });
    }
});
