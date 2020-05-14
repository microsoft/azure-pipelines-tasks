/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import os = require('os');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
    process.env['TEMP'] = '/tmp';
    process.env['MOCK_NORMALIZE_SLASHES'] = true;
}

describe('Publish Code Coverage Results Suite', function() {
    this.timeout(15000);

    before((done) => {
        done();
    });

    after(function() {

    });

    it('Publish code coverage results with all input parameters', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('reportDirectory', '/user/admin/report');
        tr.setInput('additionalCodeCoverageFiles', "/some/*pattern");

        tr.run()
            .then(() => {
                console.log(tr.stdout);
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                if (os.type().match(/^Win/)) {
                    assert(tr.stdout.search(/ReportGenerator.dll -reports:\/user\/admin\/summary.xml -targetdir:\\tmp\\cchtml -reporttypes:HtmlInline_AzurePipelines/) > 0)
                    assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=\/user\/admin\/summary.xml;reportdirectory=\\tmp\\cchtml;additionalcodecoveragefiles=some\/path\/one,some\/path\/two;\]/) >= 0, 'should publish code coverage results.');
                } else {
                    assert(tr.stdout.search(/ReportGenerator.dll -reports:\/user\/admin\/summary.xml -targetdir:\/tmp\/cchtml -reporttypes:HtmlInline_AzurePipelines/) > 0)
                    assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=\/user\/admin\/summary.xml;reportdirectory=\/tmp\/cchtml;additionalcodecoveragefiles=some\/path\/one,some\/path\/two;\]/) >= 0, 'should publish code coverage results.');
                }
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results with autogenerate without reportDirectory', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('additionalCodeCoverageFiles', "/some/*pattern");

        tr.run()
            .then(() => {
                console.log(tr.stdout);
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                if (os.type().match(/^Win/)) {
                    assert(tr.stdout.search(/ReportGenerator.dll -reports:\/user\/admin\/summary.xml -targetdir:\\tmp\\cchtml -reporttypes:HtmlInline_AzurePipelines/) > 0)
                    assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=\/user\/admin\/summary.xml;reportdirectory=\\tmp\\cchtml;additionalcodecoveragefiles=some\/path\/one,some\/path\/two;\]/) >= 0, 'should publish code coverage results.');
                } else {
                    assert(tr.stdout.search(/ReportGenerator.dll -reports:\/user\/admin\/summary.xml -targetdir:\/tmp\/cchtml -reporttypes:HtmlInline_AzurePipelines/) > 0)
                    assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=\/user\/admin\/summary.xml;reportdirectory=\/tmp\/cchtml;additionalcodecoveragefiles=some\/path\/one,some\/path\/two;\]/) >= 0, 'should publish code coverage results.');
                }
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results without report directory input', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('additionalCodeCoverageFiles', "/some/*pattern");

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/ReportGenerator.dll -reports:\/user\/admin\/summary.xml/) == -1)
                if (os.type().match(/^Win/)) {
                    assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;additionalcodecoveragefiles=some\/path\/one,some\/path\/two;\]/) >= 0, 'should publish code coverage results.');
                } else {
                    assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;additionalcodecoveragefiles=some\/path\/one,some\/path\/two;\]/) >= 0, 'should publish code coverage results.');
                }

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results conditionally fail with empty results', (done) => {
        setResponseFile('publishCCEmptyResponse.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('additionalCodeCoverageFiles', "/some/*pattern");
        tr.setInput('failIfCoverageEmpty', 'true');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.stdErrContained('No code coverage results were found to publish.'));
                assert(tr.failed, 'task should have failed');
                assert(tr.invokedToolCount == 0, 'should exit before running PublishCodeCoverageResults');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results without additional files input', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/ReportGenerator.dll -reports:\/user\/admin\/summary.xml/) == -1)
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;\]/) >= 0, 'should publish code coverage results.');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results when there are no additional files matching the given input', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('additionalCodeCoverageFiles', "/other/*pattern");

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/ReportGenerator.dll -reports:\/user\/admin\/summary.xml/) == -1)
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;additionalcodecoveragefiles=;\]/) >= 0, 'should publish code coverage results.');
                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results when directory path matches the given additonal files input', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('additionalCodeCoverageFiles', "/some/*pattern/path");

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/ReportGenerator.dll -reports:\/user\/admin\/summary.xml /) == -1)
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;additionalcodecoveragefiles=;\]/) >= 0, 'should publish code coverage results.');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results when file path matches the given additonal files input', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('additionalCodeCoverageFiles', "/some/*pattern/one");

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/ReportGenerator.dll -reports:\/user\/admin\/summary.xml /) == -1)
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;additionalcodecoveragefiles=some\/path\/one;\]/) >= 0, 'should publish code coverage results.');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results when both directory and file path matches the given additonal files input', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.setInput('codeCoverageTool', 'JaCoCo');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('additionalCodeCoverageFiles', "/some/*pattern");

        tr.run()
            .then(() => {
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');
                assert(tr.stdout.search(/ReportGenerator.dll -reports:\/user\/admin\/summary.xml /) == -1)
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=JaCoCo;summaryfile=\/user\/admin\/summary.xml;additionalcodecoveragefiles=some\/path\/one,some\/path\/two;\]/) >= 0, 'should publish code coverage results.');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results when code coverage tool is not provided', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.stdErrContained('Input required: codeCoverageTool'));
                assert(tr.failed, 'task should have failed');
                assert(tr.invokedToolCount == 0, 'should exit before running PublishCodeCoverageResults');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results when summaryfile is not provided', (done) => {
        setResponseFile('publishCCResponses.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');
        tr.setInput('codeCoverageTool', 'JaCoCo');

        tr.run()
            .then(() => {
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length > 0, 'should have written to stderr');
                assert(tr.stdErrContained('Input required: summaryFileLocation'));
                assert(tr.failed, 'task should have failed');
                assert(tr.invokedToolCount == 0, 'should exit before running PublishCodeCoverageResults');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })

    it('Publish code coverage results with all input parameters with full net framework', (done) => {
        setResponseFile('publishCCResponses_noncore.json');

        var tr = new trm.TaskRunner('PublishCodeCoverageResultsV1');

        tr.setInput('codeCoverageTool', 'Cobertura');
        tr.setInput('summaryFileLocation', '/user/admin/summary.xml');
        tr.setInput('reportDirectory', '/user/admin/report');
        tr.setInput('additionalCodeCoverageFiles', "/some/*pattern");

        if (!os.type().match(/^Win/)) {
            done();
        }

        tr.run()
            .then(() => {
                console.log(tr.stdout);
                console.log(tr.stdout);
                assert(tr.stderr.length == 0, 'should not have written to stderr. error: ' + tr.stderr);
                assert(tr.succeeded, 'task should have succeeded');

                assert(tr.stdout.search(/net47\\ReportGenerator.exe -reports:\/user\/admin\/summary.xml -targetdir:\\tmp\\cchtml -reporttypes:HtmlInline_AzurePipelines/) > 0)
                assert(tr.stdout.search(/##vso\[codecoverage.publish codecoveragetool=Cobertura;summaryfile=\/user\/admin\/summary.xml;reportdirectory=\\tmp\\cchtml;additionalcodecoveragefiles=some\/path\/one,some\/path\/two;\]/) >= 0, 'should publish code coverage results.');

                done();
            })
            .fail((err) => {
                done(err);
            });
    })
});