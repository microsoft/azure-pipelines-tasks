import * as path from 'path';
import { TestString } from './TestStrings';
import * as assert from 'assert';
import * as ttm from 'azure-pipelines-task-lib/mock-test';

describe('ACRTaskTests Suite', function () {
    this.timeout(30000);
    before((done) => {
        process.env['AGENT_VERSION'] = '2.115.0';
        process.env["SYSTEM_DEFAULTWORKINGDIRECTORY"] =  process.cwd();
        process.env["SYSTEM_TEAMFOUNDATIONCOLLECTIONURI"] = "https://abc.visualstudio.com/";
        process.env["SYSTEM_SERVERTYPE"] = "hosted";
        process.env["AGENT_TEMPDIRECTORY"] = process.cwd();
        process.env["SYSTEM_TEAMPROJECT"] = 'project1';
        process.env["SYSTEM_COLLECTIONID"] = 'collection1';

        process.env["BUILD_BUILDID"] = '1';
        process.env["BUILD_BUILDNUMBER"] = '1';
        process.env["BUILD_DEFINITIONNAME"] = 'test';
        process.env["SYSTEM_DEFINITIONID"] = '123';
        process.env["BUILD_SOURCEVERSION"] = "123abc"
        process.env["AGENT_JOBNAME"] = 'jobName';
        process.env["SYSTEM_HOSTTYPE"] = 'build';

        done();
    });

    after((done) => {
        done();
    });

    it('Validate task utility class methods', (done: Mocha.Done) => {
        let tp = path.join(__dirname, 'UtilityL0Tests.js');
        let tr : ttm.MockTestRunner = new ttm.MockTestRunner(tp);
        tr.run();
        console.log(tr.stdout);
        assert(tr.stdout.search(TestString.getResourceGroupNameFromUrlKeyword) >= 0, 'should have printed: ' + TestString.getResourceGroupNameFromUrlKeyword);
        assert(tr.stdout.search(TestString.getListOfTagValuesForImageNamesKeyword) >= 0, 'should have printed: ' + TestString.getListOfTagValuesForImageNamesKeyword);
        assert(tr.stdout.search(TestString.getImageNamesForGitKeyword) >= 0, 'should have printed: ' + TestString.getImageNamesForGitKeyword);
        assert(tr.stdout.search(TestString.getImageNamesForFileKeyword) >= 0, 'should have printed: ' + TestString.getImageNamesForFileKeyword);
        assert(tr.stdout.search(TestString.createBuildCommandKeyWord) >= 0, 'should have printed: ' + TestString.createBuildCommandKeyWord);
        
        done();
    });
});