import path = require('path');
var psm = require('../../../../Tests/lib/psRunner');
var psr = null;

export function testPowerShellImpl() {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done) => {
        if (psm.testSupported()) {
            psr = new psm.PSRunner();
            psr.start();
        }

        done();
    });

    after(() => {
        if (psr) {
            psr.kill();
        }
    });

    if (psm.testSupported()) {
        it('Run of L0Expand-EnvVariables tests suite.', (done) => {
            psr.run(path.join(__dirname, 'L0Expand-EnvVariables.ps1'), done);
        })

        it('Run of L0Test-FileArgs.Passes tests suite.', (done) => {
            psr.run(path.join(__dirname, 'L0Test-FileArgs.Passes.ps1'), done);
        })

        it('Run of L0Test-FileArgs.Fails tests suite.', (done) => {
            psr.run(path.join(__dirname, 'L0Test-FileArgs.Fails.ps1'), done);
        })
    }
}
