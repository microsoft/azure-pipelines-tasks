import fs = require("fs");
import assert = require("assert");
import path = require("path");
import * as tl from "azure-pipelines-task-lib/task";
import * as ttm from "azure-pipelines-task-lib/mock-test";

const tempDir = path.join(__dirname, "temp");
const rootDir = path.join(__dirname, "out");
const destinationDir = path.join(rootDir, "packageOutput");

describe("Download single file package suite", function() {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    beforeEach(() => {
        tl.mkdirP(destinationDir);
        tl.mkdirP(tempDir);
    });

    afterEach(() => {
        tl.rmRF(rootDir);
        tl.rmRF(tempDir);
    });

    it("downloads nuget file as nupkg and extracts it", (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0DownloadNugetPackage.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tl.ls(null, [tempDir]).length, 1, "should have only 1 file.");
        const zipPath = path.join(tempDir, "singlePackageName.nupkg");
        const zipStats = tl.stats(zipPath);
        assert(zipStats && zipStats.isFile(), "nupkg file should be downloaded");

        var extractedFilePath = path.join(destinationDir, "nugetFile");
        const fileStats = tl.stats(extractedFilePath);
        assert(fileStats && fileStats.isFile(), "nupkg file should be extracted");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");

        done();
    });

    it("downloads nuget file as nupkg and does not extract it", (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0DownloadNugetPackage_noextract.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tl.ls(null, [tempDir]).length, 0, "no files should be in temp folder.");

        assert.equal(tl.ls(null, [destinationDir]).length, 1, "should have only 1 file.");
        const zipPath = path.join(destinationDir, "singlePackageName.nupkg");
        const zipStats = tl.stats(zipPath);
        assert(zipStats && zipStats.isFile(), "nupkg file should be downloaded");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");

        done();
    });

    it("downloads npm file as tgz and extracts it", (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0DownloadNpmPackage.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert.equal(tl.ls(null, [tempDir]).length, 1, "should have only 1 file.");
        const zipPath = path.join(tempDir, "singlePackageName.tgz");
        const zipStats = tl.stats(zipPath);
        assert(zipStats && zipStats.isFile(), "tgz file should be downloaded");

        var extractedFilePath = path.join(destinationDir, "npmFile");
        const fileStats = tl.stats(extractedFilePath);
        assert(fileStats && fileStats.isFile(), "tgz file should be extracted");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");

        done();
    });
});

describe("Download multi file package suite", function() {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before(() => {
        tl.mkdirP(destinationDir);
    });

    after(() => {
        tl.rmRF(rootDir);
    });

    it("only downloads jar and pom files from the maven archive and doesn't extract them", (done: MochaDone) => {
        this.timeout(1000);

        let tp: string = path.join(__dirname, "L0DownloadMultiFilePackage.js");

        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        let outputJarPath: string = path.join(destinationDir, "packageName.jar");
        let outputPomPath: string = path.join(destinationDir, "packageName.pom");
        assert.equal(tl.ls(null, [destinationDir]).length, 2, "should have only 2 files.");
        const statsJar = tl.stats(outputJarPath);
        const statsPom = tl.stats(outputPomPath);

        assert(statsJar && statsJar.isFile(), "jar file should be downloaded");
        assert(statsPom && statsPom.isFile(), "pom file should be downloaded");

        assert(tr.stderr.length === 0, "should not have written to stderr");
        assert(tr.succeeded, "task should have succeeded");

        done();
    });
});
