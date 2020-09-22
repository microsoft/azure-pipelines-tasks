import assert = require('assert');
import path = require('path');
import * as ttm from 'azure-pipelines-task-lib/mock-test';


describe('ExtractFile Suite', function () {
    this.timeout(60000);

    function runValidations(validator: () => void, tr, done) {
        try {
            validator();
            done();
        }
        catch (error) {
            console.log("STDERR", tr.stderr);
            console.log("STDOUT", tr.stdout);
            done(error);
        }
    }

    it('Successfully extracts a single zip', (done: MochaDone) => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip1.zip';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted zip1') > -1);
        }, tr, done);
    });

    it('Successfully extracts multiple zips', (done: MochaDone) => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip1.zip\nzip2.zip';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted zip1') > -1);
            assert(tr.stdout.indexOf('extracted zip2') > -1);
        }, tr, done);
    });

    it('Successfully extracts a tar', (done: MochaDone) => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'tar.tar';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted tar') > -1);
        }, tr, done);
    });

    it('Successfully cleans destination', (done: MochaDone) => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip1.zip';
        process.env['overwriteExistingFiles'] = 'true';
        process.env['cleanDestinationFolder'] = 'true';

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted zip1') > -1);
            assert(tr.stdout.indexOf('Removing ' + __dirname) > -1);
        }, tr, done);
    });
    
    it('Successfully overwrites files from zip in output directory', (done: MochaDone) => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'zip1.zip';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // run it twice to check files that was created during first run will be overwritten
        tr.run();
        tr.run();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted zip1') > -1);
        }, tr, done);
    });

    it('Successfully overwrites files from tar in output directory', (done: MochaDone) => {
        this.timeout(5000);
        process.env['archiveFilePatterns'] = 'tar.tar';
        process.env['overwriteExistingFiles'] = 'true';
        delete process.env['cleanDestinationFolder'];

        let tp: string = path.join(__dirname, 'L0Extract.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // run it twice to check files that was created during first run will be overwritten
        tr.run();
        tr.run();

        runValidations(() => {
            assert(tr.stdout.indexOf('extracted tar') > -1);
        }, tr, done);
    });
});