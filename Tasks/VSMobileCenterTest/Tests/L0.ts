
// npm install mocha --save-dev
// typings install dt~mocha --save --global

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';

describe('VSMobileCenterTest L0 Suite', function () {
    before(() => {
        //Enable this for output
        //process.env['TASK_TEST_TRACE'] = 1; 

        //setup endpoint
        process.env["ENDPOINT_AUTH_MyTestEndpoint"] = "{\"parameters\":{\"apitoken\":\"mytoken123\"},\"scheme\":\"apitoken\"}";
        process.env["ENDPOINT_AUTH_PARAMETER_MyTestEndpoint_APITOKEN"] = "mytoken123";
    });

    after(() => {

    });

    it('Positive path: upload Appium test with service endpoint', (done: MochaDone) => {
        this.timeout(2000);

        let tp = path.join(__dirname, 'L0AppiumPass.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount === 2, 'Should have run test prepare and test run');
        assert(tr.ran("/path/to/mobile-center test prepare appium --artifacts-dir " + 
            "/path/to/artifactsDir --build-dir /path/to/appium_build_dir --debug --quiet"), 
            "Should have run prepare");

        assert(tr.ran("/path/to/mobile-center test run manifest " + 
            "--manifest-path /path/to/artifactsDir/manifest.json --app-path " + 
            "/test/path/to/my.ipa --app testuser/testapp --devices 1234abcd " +
            "--test-series master --dsym-dir /path/to/dsym --locale nl_NL --debug --quiet --token mytoken123"), 
            "Should have run test run");

        done();
    });

    it('Positive path: upload Espresso test with service endpoint', (done: MochaDone) => {
        this.timeout(2000);

        let tp = path.join(__dirname, 'L0EspressoPass.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount === 2, 'Should have run test prepare and test run');
        assert(tr.ran("/path/to/mobile-center test prepare espresso --artifacts-dir " + 
            "/path/to/artifactsDir --build-dir /path/to/espresso_build_dir --test-apk-path /path/to/espresso_test_apk --debug --quiet"), 
            "Should have run prepare");

        assert(tr.ran("/path/to/mobile-center test run manifest " + 
            "--manifest-path /path/to/artifactsDir/manifest.json --app-path " + 
            "/test/path/to/my.ipa --app testuser/testapp --devices 1234abcd " +
            "--test-series master --dsym-dir /path/to/dsym --locale nl_NL --debug --quiet --token mytoken123"), 
            "Should have run test run");

        done();
    });

    it('Positive path: upload Calabash test with service endpoint', (done: MochaDone) => {
        this.timeout(2000);

        let tp = path.join(__dirname, 'L0CalabashPass.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount === 2, 'Should have run test prepare and test run');
        assert(tr.ran("/path/to/mobile-center test prepare calabash --artifacts-dir " +
            "/path/to/artifactsDir --app-path /test/path/to/my.ipa --project-dir " +
            "/path/to/project --sign-info SignInfo --config /path/to/configfile " +
            "--profile myProfile --quiet"),
            "Should have run prepare");

        assert(tr.ran("/path/to/mobile-center test run manifest " +
            "--manifest-path /path/to/artifactsDir/manifest.json --app-path /test/path/to/my.ipa " + 
            "--app testuser/testapp --devices 1234abcd --test-series master --dsym-dir /path/to/dsym " + 
            "--async --locale nl_NL --myRunOpts abc --quiet --token mytoken123"), 
            "Should have run test run");

        done();
    });

    it('Positive path: upload UITest with username and password', (done: MochaDone) => {
        this.timeout(2000);

        let tp = path.join(__dirname, 'L0UITestPass.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount === 4, 'Should have run login, logout, test prepare and test run');
        assert(tr.ran("/path/to/mobile-center login -u MyUsername -p MyPassword --quiet"),
            "Should have run login");

        assert(tr.ran("/path/to/mobile-center logout --quiet"),
            "Should have run logout");

        assert(tr.ran("/path/to/mobile-center test prepare uitest --artifacts-dir " + 
            "/path/to/artifactsDir --app-path /test/path/to/my.ipa --build-dir /path/to/uitest_build_dir --myopts --quiet"), 
            "Should have run prepare");

        assert(tr.ran("/path/to/mobile-center test run manifest " + 
            "--manifest-path /path/to/artifactsDir/manifest.json --app-path " + 
            "/test/path/to/my.ipa --app testuser/testapp --devices 1234abcd " +
            "--test-series master --dsym-dir /path/to/dsym --locale nc_US --quiet"), 
            "Should have run test run");

        done();
    });

    it('Negative path: with username and password, should always logout even test prepare failed', (done: MochaDone) => {
        this.timeout(2000);

        let tp = path.join(__dirname, 'L0UITestFailRun.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        assert(tr.failed, 'task should have failed');
        assert.equal(tr.invokedToolCount, 3, 'Should have run login, test prepare and logout');
        assert(tr.ran("/path/to/mobile-center login -u MyUsername -p MyPassword --quiet"),
            "Should have run login");

        assert(tr.ran("/path/to/mobile-center logout --quiet"),
            "Should have run logout");

        assert(tr.ran("/path/to/mobile-center test run manifest --manifest-path " + 
            "/path/to/artifactsDir/manifest.json --app-path /test/path/to/my.ipa --app testuser/testapp --devices 1234abcd --test-series master --dsym-dir /path/to/dsym --locale nc_US --quiet"), 
            "Should have run 'run'");

        done();
    });

    it('Favor system mobile-center cli over bundled cli', (done: MochaDone) => {
        this.timeout(2000);

        let tp = path.join(__dirname, 'L0FavorSystemToolPath.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        
        tr.run();
        assert(tr.failed, 'task should have failed');

        assert(tr.invokedToolCount === 1, 'Should have run login only');
        assert(tr.ran("/system/path/to/mobile-center login -u MyUsername -p MyPassword --quiet"),
            "Should have run login");

        done();
    });

 });
