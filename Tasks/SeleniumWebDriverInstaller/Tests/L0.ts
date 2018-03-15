import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';
import * as constants from './Constants';
import * as tl from 'vsts-task-lib';

describe('SeleniumWebdriverInstaller Suite', function() {
    this.timeout(10000);

    if (!tl.osType().match(/^Win/)) {
        return;
    }

    before((done) => {
        done();
    });

    beforeEach((done) => {
        // Clear all inputs and other environment variables
        delete process.env[constants.downloadPath];
        delete process.env[constants.cacheHitReturnValue];
        delete process.env[constants.findLocalToolSecondCallReturnValue];
        delete process.env[constants.ieDriver];
        delete process.env[constants.firefoxDriver];
        delete process.env[constants.chromeDriver];
        delete process.env[constants.edgeDriver];
        delete process.env[constants.edgeDriverVersion];

        done();
    });

    after(function () {
        //console.log('after');
    });

    it('Get chromedriver cache hit', (done: MochaDone) => {
        console.log('TestCaseName: Get chromedriver cache hit');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.chromeDriver] = 'true';
        process.env[constants.chromeDriverVersion] = '2.3.0';
        process.env[constants.cacheHitReturnValue] = `chromedriver\\${process.env[constants.chromeDriverVersion]}`;
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.downloadPath] = 'temp\\chromedriver';
        
        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained(`Found version 2.3.0 of driver ChromeWebDriver in cache`), `Should have been cache hit scenario.`);
        assert(tr.stdOutContained(`set ChromeWebDriver=chromedriver\\2.3.0`), `Should have set chrome driver env var.`);
        done();
    });

    it('Get chromedriver cache miss', (done: MochaDone) => {
        console.log('TestCaseName: Get chromedriver cache miss');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.chromeDriver] = 'true';
        process.env[constants.chromeDriverVersion] = '2.3.0';
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.downloadPath] = 'temp\\chromedriver';

        // Start the run
        tr.run();
        
        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained('Could not find version 2.3.0 of driver ChromeWebDriver, will download it'), 'Should have been cache miss scenario.');
        assert(tr.stdOutContained('set ChromeWebDriver=ChromeWebDriver\\2.3.0'));

        done();
    });

    it('Get firefoxdriver acquires geckodriver', (done: MochaDone) => {
        console.log('TestCaseName: Get firefoxdriver acquires geckodriver');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.firefoxDriver] = 'true';
        process.env[constants.firefoxDriverVersion] = '2.3.0';
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.downloadPath] = 'temp\\firefoxdriver';
    
        // Start the run
        tr.run();

        // Asserts
        
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained('Could not find version 2.3.0 of driver GeckoWebDriver, will download it'), 'Should have downloded firefox driver.');
        assert(tr.stdOutContained('set GeckoWebDriver=GeckoWebDriver\\2.3.0'));
        done();
    });

    it('Get firefoxdriver acquires iedriver', (done: MochaDone) => {
        console.log('TestCaseName: Get iedriver acquires iedriver');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.ieDriver] = 'true';
        process.env[constants.ieDriverVersion] = '2.3.0';
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.downloadPath] = 'temp\\iedriver';
    
        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained('Could not find version 2.3.0 of driver IEWebDriver, will download it'), 'Should have downloded ie driver.');
        assert(tr.stdOutContained('set IEWebDriver=IEWebDriver\\2.3.0'));
        done();
    });

    it('Get edgedriver acquires edgedriver', (done: MochaDone) => {
        console.log('TestCaseName: Get edgedriver acquires edgedriver');

        // Setup the mock runner
        const tp = path.join(__dirname, 'TestSetup.js');
        const tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        // Set the inputs
        process.env[constants.edgeDriver] = 'true';
        process.env[constants.edgeDriverVersion] = '2.3.0';
        process.env[constants.agentTempDirectory] = 'temp';
        process.env[constants.downloadPath] = 'temp\\egdedriver';
    
        // Start the run
        tr.run();

        // Asserts
        assert(tr.stderr.length === 0 || tr.errorIssues.length, 'should not have written to stderr');
        assert(tr.succeeded, `Task should have succeeded`);
        assert(tr.stdOutContained('Could not find version 2.3.0 of driver EdgeWebDriver, will download it'), 'Should have downloded edge driver.');
        assert(tr.stdOutContained('set EdgeWebDriver=EdgeWebDriver\\2.3.0'));
        done();
    });
});
