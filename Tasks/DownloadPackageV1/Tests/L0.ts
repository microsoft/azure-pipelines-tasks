import fs = require('fs');
import assert = require('assert');
import path = require('path');
import * as tl from "vsts-task-lib/task";
import * as ttm from 'vsts-task-lib/mock-test';

const outputDir = path.join(__dirname, "out");

describe('Download single file package suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before(() => {
        fs.mkdir(outputDir);
    });

    after(() => {
        tl.rmRF(outputDir);
    });

    it('downloads nuget file as zip and extracts it', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0DownloadSingleFilePackage.js');

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tl.ls(null, [outputDir]).length == 1, "should have only 1 file.");
        const zipPath = path.join(outputDir, "singlePackageName.zip");
        const stats = tl.stats(zipPath);
        assert(stats && stats.isFile(), "zip file should be downloaded");
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
});



describe('Download multi file package suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before(() => {
        fs.mkdir(outputDir);
    });

    after(() => {
        tl.rmRF(outputDir);
    });

    it('only downloads jar and pom files from the maven archive and doesn\'t extract them', (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, 'L0DownloadMultiFilePackage.js');

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        let outputJarPath: string = path.join(outputDir, "packageName.jar");
        let outputPomPath: string = path.join(outputDir, "packageName.pom");
        assert(tl.ls(null, [outputDir]).length == 2, "should have only 2 files.");
        const statsJar = tl.stats(outputJarPath);
        const statsPom = tl.stats(outputPomPath);

        assert(statsJar && statsJar.isFile(), "jar file should be downloaded");
        assert(statsPom && statsPom.isFile(), "pom file should be downloaded");

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
});