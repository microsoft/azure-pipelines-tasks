import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';

// Declare mocha globals for tsc
/* eslint-disable @typescript-eslint/no-unused-vars */
declare var describe: any; // provided by mocha at runtime
declare var it: any; // provided by mocha
declare var __dirname: string;
/* eslint-enable @typescript-eslint/no-unused-vars */

describe('GoToolV0 Suite', function () {
    this.timeout(30000);

    function runValidations(validator: () => void, tr: ttm.MockTestRunner) {
        try {
            validator();
        }
        catch (error) {
            console.log('STDERR', tr.stderr);
            console.log('STDOUT', tr.stdout);
            throw error;
        }
    }

    it('Installs version from go.mod (single file)', async () => {
        process.env['__case__'] = 'useGoModSingle';
        const tp = path.join(__dirname, 'gotoolTests.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdout.indexOf("Parsed Go version '1.22'") > -1, 'Should log parsed Go version 1.22');
        }, tr);
    });

    it('Installs versions from multiple go.mod files', async () => {
        process.env['__case__'] = 'useGoModMulti';
        const tp = path.join(__dirname, 'gotoolTests.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdout.indexOf("Parsed Go version '1.21'") > -1, 'Should parse 1.21');
            assert(tr.stdout.indexOf("Parsed Go version '1.22'") > -1, 'Should parse 1.22');
        }, tr);
    });

    it('Fails when go.mod not found', async () => {
        process.env['__case__'] = 'useGoModNotFound';
        const tp = path.join(__dirname, 'gotoolTests.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.failed, 'Task should have failed');
            assert(tr.stdout.indexOf('FailedToFindGoMod') > -1 || tr.stderr.indexOf('FailedToFindGoMod') > -1, 'Should output failure message for missing go.mod');
        }, tr);
    });

    it('Installs version from explicit input (useGoMod disabled)', async () => {
        process.env['__case__'] = 'explicitVersion';
        const tp = path.join(__dirname, 'gotoolTests.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        await tr.runAsync();
        runValidations(() => {
            assert(tr.succeeded, 'Task should have succeeded');
            assert(tr.stdout.indexOf('Go tool is cached under') > -1, 'Should have cached the tool');
        }, tr);
    });
});

