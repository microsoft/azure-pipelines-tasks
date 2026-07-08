import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

function runValidations(validator: () => void, tr) {
    try {
        validator();
    }
    catch (error) {
        console.log("STDERR", tr.stderr);
        console.log("STDOUT", tr.stdout);
        throw error;
    }
}

describe('NodeTaskRunnerInstaller Suite', function () {
    this.timeout(60000);

    it('Succeeds when installing Node 6 runner', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0InstallNode6.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTaskRunnerInstaller should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTaskRunnerInstaller should not have written to stderr');
        }, tr);
    });

    it('Succeeds when installing Node 10 runner', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0InstallNode10.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTaskRunnerInstaller should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTaskRunnerInstaller should not have written to stderr');
        }, tr);
    });

    it('Succeeds when installing Node 16 runner', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0InstallNode16.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTaskRunnerInstaller should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTaskRunnerInstaller should not have written to stderr');
        }, tr);
    });

    it('Skips installation when runner already installed', async () => {
        this.timeout(5000);

        let tp: string = path.join(__dirname, 'L0RunnerAlreadyInstalled.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.succeeded, 'NodeTaskRunnerInstaller should have succeeded.');
            assert(tr.stderr.length === 0, 'NodeTaskRunnerInstaller should not have written to stderr');
        }, tr);
    });
});
