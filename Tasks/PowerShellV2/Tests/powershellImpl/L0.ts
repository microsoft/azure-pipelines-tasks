import path = require('path');
var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

export const runPowershellSuite = () => {
    describe('PowerShell Impl Suite', function () {
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
            it('Should parse a simple argument string', (done) => {
                psr.run(path.join(__dirname, 'ShouldParseSimpleArgumentString.ps1'), done);
            })

            it('Should handle env variable content as single arg', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleEnvVariableContentAsSingleArg.ps1'), done);
            })

            it('Should handle env variable content as single arg 2', (done) => {
                psr.run(path.join(__dirname, 'ShouldHandleEnvVariableContentAsSingleArg2.ps1'), done);
            })
        }
    });
}
