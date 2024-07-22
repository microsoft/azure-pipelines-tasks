import { MockTestRunner } from 'azure-pipelines-task-lib/mock-test';
import fs = require('fs');
import os = require('os');
import assert = require('assert');
import path = require('path');

const isWindows = os.type().match(/^Win/);

describe('PublishCodeCoverageResultsV1 Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 15000);

    before(function () {
        process.env["AGENT_TEMPDIRECTORY"] = process.cwd();
    });

    it('Publish code coverage results with all input parameters', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0AllInputs.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');
        if (isWindows) {
            assert(tr.stdOutContained(`ReportGenerator.dll -reports:/user/admin/summary.xml -targetdir:${process.cwd()}\\cchtml -reporttypes:HtmlInline_AzurePipelines`), 'Should run ReportGenerator properly');
            assert(tr.stdOutContained(`##vso[codecoverage.publish codecoveragetool=Cobertura;summaryfile=/user/admin/summary.xml;reportdirectory=user/admin/report;additionalcodecoveragefiles=some/path/one,some/path/two;]`), 'should publish code coverage results.');
        } else {
            assert(tr.stdOutContained(`ReportGenerator.dll -reports:/user/admin/summary.xml -targetdir:${process.cwd()}/cchtml -reporttypes:HtmlInline_AzurePipelines`), 'Should run ReportGenerator properly');
            assert(tr.stdOutContained(`##vso[codecoverage.publish codecoveragetool=Cobertura;summaryfile=/user/admin/summary.xml;reportdirectory=user/admin/report;additionalcodecoveragefiles=some/path/one,some/path/two;]`), 'should publish code coverage results.');
        }
        done();
    });

    it('Publish code coverage results with autogenerate without reportDirectory', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0WithoutReportDir.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');

        if (isWindows) {
            assert(tr.stdOutContained(`ReportGenerator.dll -reports:/user/admin/summary.xml -targetdir:${process.cwd()}\\cchtml -reporttypes:HtmlInline_AzurePipelines`), 'Should run ReportGenerator properly');
            assert(tr.stdOutContained(`##vso[codecoverage.publish codecoveragetool=Cobertura;summaryfile=/user/admin/summary.xml;additionalcodecoveragefiles=some/path/one,some/path/two;]`), 'should publish code coverage results.');
        } else {
            assert(tr.stdOutContained(`ReportGenerator.dll -reports:/user/admin/summary.xml -targetdir:${process.cwd()}/cchtml -reporttypes:HtmlInline_AzurePipelines`), 'Should run ReportGenerator properly');
            assert(tr.stdOutContained(`##vso[codecoverage.publish codecoveragetool=Cobertura;summaryfile=/user/admin/summary.xml;additionalcodecoveragefiles=some/path/one,some/path/two;]`), 'should publish code coverage results.');
        }
        done();
    });

    it('Publish code coverage results without report directory input', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0JacocoWithoutReportDir.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');
        assert(!tr.stdOutContained('ReportGenerator.dll -reports:/user/admin/summary.xml'), 'Should not run ReportGenerator');
        assert(tr.stdOutContained(`##vso[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=/user/admin/summary.xml;additionalcodecoveragefiles=some/path/one,some/path/two;]`), 'should publish code coverage results.');
        done();
    });

    it('Publish code coverage results conditionally fail with empty results', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0FailWithEmptyResults.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('loc_mock_NoCodeCoverage'), 'Should have found no code coverage to publish');
        assert(tr.invokedToolCount == 0, 'should exit before running PublishCodeCoverageResults');
        done();
    });

    it('Publish code coverage results without additional files input', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0NoAdditionalFiles.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');
        assert(!tr.stdOutContained('ReportGenerator.dll -reports:/user/admin/summary.xml'), 'Should not have run ReportGenerator')
        assert(tr.stdOutContained('##vso[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=/user/admin/summary.xml;]'), 'should publish code coverage results.');

        done();
    });

    it('Publish code coverage results when there are no additional files matching the given input', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0NoAdditionalFilesMatch.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');
        assert(!tr.stdOutContained('ReportGenerator.dll -reports:/user/admin/summary.xml'), 'Should not have run ReportGenerator');
        assert(tr.stdOutContained('##vso[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=/user/admin/summary.xml;additionalcodecoveragefiles=;]'), 'should publish code coverage results.');

        done();
    });

    it('Publish code coverage results when directory path matches the given additonal files input', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0AdditionalFilesDirMatches.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');
        assert(!tr.stdOutContained('ReportGenerator.dll -reports:/user/admin/summary.xml'), 'Should not have run ReportGenerator');
        assert(tr.stdOutContained('##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=/user/admin/summary.xml;additionalcodecoveragefiles=;]'), 'should publish code coverage results.');
        done();
    });

    it('Publish code coverage results when file path matches the given additonal files input', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0AdditionalFilesPathMatches.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');
        assert(!tr.stdOutContained('ReportGenerator.dll -reports:/user/admin/summary.xml'), 'Should not have run ReportGenerator');
        assert(tr.stdOutContained('##vso[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=/user/admin/summary.xml;additionalcodecoveragefiles=some/path/one;]'), 'should publish code coverage results.');

        done();
    });

    it('Publish code coverage results when both directory and file path matches the given additonal files input', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0BothDirAndFilesMatch.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
        assert(tr.succeeded, 'task should have succeeded');
        assert(!tr.stdOutContained('ReportGenerator.dll -reports:/user/admin/summary.xml'), 'Should not have run ReportGenerator');
        assert(tr.stdOutContained('##vso[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=/user/admin/summary.xml;additionalcodecoveragefiles=some/path/one,some/path/two;]'), 'should publish code coverage results.');

        done();
    });

    it('Publish code coverage results when code coverage tool is not provided', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0NoResultsProvided.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('Input required: codeCoverageTool'));
        assert(tr.invokedToolCount == 0, 'should exit before running PublishCodeCoverageResults');

        done();
    });

    it('Publish code coverage results when summaryfile is not provided', function (done: Mocha.Done) {
        const testPath = path.join(__dirname, 'L0NoSummaryProvided.js')
        const tr: MockTestRunner = new MockTestRunner(testPath);
        tr.run();

        assert(tr.failed, 'task should have failed');
        assert(tr.stdOutContained('Input required: summaryFileLocation'));
        assert(tr.invokedToolCount == 0, 'should exit before running PublishCodeCoverageResults');

        done();
    });
    
    if (isWindows) {
        it('Publish code coverage results with all input parameters with full net framework (Windows only)', function (done: Mocha.Done) {
            const testPath = path.join(__dirname, 'L0FullNetFramework.js')
            const tr: MockTestRunner = new MockTestRunner(testPath);
            tr.run();
    
            assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
            assert(tr.succeeded, 'task should have succeeded');
            assert(tr.stdOutContained(`net47\\ReportGenerator.exe -reports:/user/admin/summary.xml -targetdir:${process.cwd()}\\cchtml -reporttypes:HtmlInline_AzurePipelines`), 'Should have run noncore ReportGenerator');
            assert(tr.stdOutContained(`##vso[codecoverage.publish codecoveragetool=Cobertura;summaryfile=/user/admin/summary.xml;reportdirectory=user/admin/report;additionalcodecoveragefiles=some/path/one,some/path/two;]`), 'should publish code coverage results.');

            done();
        });
    }
});
