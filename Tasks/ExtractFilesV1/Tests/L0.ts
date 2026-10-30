import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';


describe('ExtractFile Suite', function () {
    this.timeout(60000);

    for (const extension of ['zip', 'tar', '7z']) {
        it(`neutralizes archive names and ${extension} stdout/stderr`, async () => {
            const previous = process.env['OUTPUT_TEST_EXTENSION'];
            process.env['OUTPUT_TEST_EXTENSION'] = extension;
            try {
                const runner = new ttm.MockTestRunner(path.join(__dirname, 'L0LoggingCommands.js'));
                await runner.runAsync();
                assert(runner.succeeded, runner.stdout + runner.stderr);
                assert(runner.stdout.includes('archive##_vso[task.setvariable variable=Injected]sentinel.'));
                const output = runner.stdout + runner.stderr;
                for (const channel of ['stdout', 'stderr']) {
                    assert(output.includes(`entry ${channel} ##_vso[task.setvariable variable=Injected]sentinel`));
                    assert(!output.includes(`entry ${channel} ##vso[task.setvariable variable=Injected]sentinel`));
                }
            } finally {
                if (previous === undefined) {
                    delete process.env['OUTPUT_TEST_EXTENSION'];
                } else {
                    process.env['OUTPUT_TEST_EXTENSION'] = previous;
                }
            }
        });
    }

    function runValidations(validator: () => void, tr: ttm.MockTestRunner) {
        try {
            validator();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            throw error;
        }
    }

    it('Successfully extracts a single zip', async () => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip1.zip';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted zip1') > -1);
        }, tr);
    });

    it('Successfully extracts multiple zips', async () => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip1.zip\nzip2.zip';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted zip1') > -1);
            assert(tr.stdout.indexOf('extracted zip2') > -1);
        }, tr);
    });

    it('Successfully extracts a tar', async () => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'tar.tar';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted tar') > -1);
        }, tr);
    });

    it('Successfully cleans destination', async () => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip1.zip';
        process.env['overwriteExistingFiles'] = 'true';
        process.env['cleanDestinationFolder'] = 'true';

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted zip1') > -1);
            assert(tr.stdout.indexOf('Removing ' + __dirname) > -1);
        }, tr);
    });
    
    it('Successfully overwrites files from zip in output directory', async () => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip1.zip';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // run it twice to check files that was created during first run will be overwritten
        await tr.runAsync();
        await tr.runAsync();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted zip1') > -1);
        }, tr);
    });

    it('Successfully overwrites files from tar in output directory', async () => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'tar.tar';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // run it twice to check files that was created during first run will be overwritten
        await tr.runAsync();
        await tr.runAsync();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted tar') > -1);
        }, tr);
    });

    it('Successfully extracts a 7z', async () => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip3.7z';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted 7z') > -1);
        }, tr);
    });

    it('User is able to setup custom path to 7z', async () => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip3.7z';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];
        process.env['pathToSevenZipTool'] = 'custom/7z/path';

        let tp: string = path.join(__dirname, 'L07zFromDifferentLocations.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.stderr.length == 0, tr.stderr);
        }, tr);
    });

    it('Default path is used for 7z tool', async () => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip3.7z';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L07zFromDifferentLocations.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        await tr.runAsync();

        runValidations(() => {
            assert(tr.stderr.length == 0, tr.stderr);
        }, tr);
    });
});
