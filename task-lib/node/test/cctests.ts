// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as tl from '../_build/task';
import testutil = require('./testutil');

describe('Code Coverage Tests', function () {

    before(function (done) {
        try {
            testutil.initialize();
        }
        catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function () {

    });


    it('publish code coverage passes all the properties properly', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        var ccPublisher = new tl.CodeCoveragePublisher();
        ccPublisher.publish("Jacoco", "\\user\\admin\\summary.xml", "\\user\\admin\\report", "\\user\\admin\\report\\t.xml,\\user\\admin\\report\\c.xml");

        var output = stdStream.getContents();
        var expectedOutput = testutil.buildOutput(["##vso[codecoverage.publish codecoveragetool=Jacoco;summaryfile=\\user\\admin\\summary.xml;reportdirectory=\\user\\admin\\report;additionalcodecoveragefiles=\\user\\admin\\report\\t.xml,\\user\\admin\\report\\c.xml;]"]);
        assert.equal(expectedOutput, output);
        done();
    })

    it('publish code coverage does not pass properties when the imput parameters are empty', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        var ccPublisher = new tl.CodeCoveragePublisher();
        ccPublisher.publish("", "", "", "");

        var output = stdStream.getContents();
        var expectedOutput = testutil.buildOutput(["##vso[codecoverage.publish]"]);
        assert.equal(expectedOutput, output);
        done();
    })

    it('publish code coverage does not pass properties when the input parameters are null', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        var ccPublisher = new tl.CodeCoveragePublisher();
        ccPublisher.publish(null, null, null, null);

        var output = stdStream.getContents();
        var expectedOutput = testutil.buildOutput(["##vso[codecoverage.publish]"]);
        assert.equal(expectedOutput, output);
        done();
    })

    it('enable code coverage does not pass properties when the input parameters are null', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        var ccEnabler = new tl.CodeCoverageEnabler(null, null);
        var buildProps: { [key: string]: string } = {};
        ccEnabler.enableCodeCoverage(buildProps);

        var output = stdStream.getContents();
        var expectedOutput = testutil.buildOutput(["##vso[codecoverage.enable ]"]);
        assert.equal(expectedOutput, output);
        done();
    })

    it('enable code coverage passes properties when the input parameters are existing', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        var ccEnabler = new tl.CodeCoverageEnabler("jacoco", "buildtool");
        var buildProps: { [key: string]: string } = {};
        buildProps['abc'] = 'xyz';
        ccEnabler.enableCodeCoverage(buildProps);

        var output = stdStream.getContents();
        var expectedOutput = testutil.buildOutput(["##vso[codecoverage.enable abc=xyz;buildtool=jacoco;codecoveragetool=buildtool;]"]);
        assert.equal(expectedOutput, output);
        done();
    })

    it('enable code coverage passes parameters when the input parameters are empty', function (done) {
        this.timeout(1000);

        var stdStream = testutil.createStringStream();
        tl.setStdStream(stdStream);
        var ccEnabler = new tl.CodeCoverageEnabler("jacoco", "buildtool");
        var buildProps: { [key: string]: string } = {};
        ccEnabler.enableCodeCoverage(buildProps);

        var output = stdStream.getContents();
        var expectedOutput = testutil.buildOutput(["##vso[codecoverage.enable buildtool=jacoco;codecoveragetool=buildtool;]"]);
        assert.equal(expectedOutput, output);
        done();
    })
});
