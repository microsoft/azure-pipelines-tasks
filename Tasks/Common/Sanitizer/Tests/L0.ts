/// <reference path="../../../../definitions/mocha.d.ts"/>
/// <reference path="../../../../definitions/node.d.ts"/>

import path = require('path');

var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

describe('Security Suite', function () {
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
        it('Sanitize-Arguments should replace forbidden characters', (done) => {
            psr.run(path.join(__dirname, 'L0Get-SanitizedArgumentsArray.ReplacesForbiddenCharacters.ps1'), done);
        });
    }

    if (psm.testSupported()) {
        it('Sanitize-Arguments should not break existing Cmd argument formats', (done) => {
            psr.run(path.join(__dirname, 'L0Get-SanitizedArgumentsArray.DoesNotBreakExistingCmdFormats.ps1'), done);
        });
    }

    if (psm.testSupported()) {
        it('Sanitize-Arguments should not break existing PowerShell argument formats', (done) => {
            psr.run(path.join(__dirname, 'L0Get-SanitizedArgumentsArray.DoesNotBreakExistingPowerShellFormats.ps1'), done);
        });
    }

    if (psm.testSupported()) {
        it('Sanitize-Arguments should not break existing Bash argument formats', (done) => {
            psr.run(path.join(__dirname, 'L0Get-SanitizedArgumentsArray.DoesNotBreakExistingBashFormats.ps1'), done);
        });
    }

    if (psm.testSupported()) {
        it('Protect-ScriptArguments should pass correctly', (done) => {
            psr.run(path.join(__dirname, 'L0Protect-ScriptArguments.Passes.ps1'), done);
        });
    }

    if (psm.testSupported()) {
        it('Protect-ScriptArguments should throw', (done) => {
            psr.run(path.join(__dirname, 'L0Protect-ScriptArguments.Throws.ps1'), done);
        });
    }

    if (psm.testSupported()) {
        it('L0Expand-EnvVariables tests', (done) => {
            psr.run(path.join(__dirname, 'L0Expand-EnvVariables.ps1'), done);
        });
    }
});
