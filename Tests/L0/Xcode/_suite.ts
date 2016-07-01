/// <reference path="../../../definitions/mocha.d.ts"/>
/// <reference path="../../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');

function setResponseFile(name: string) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

describe('Xcode Suite', function() {
    this.timeout(20000);

    before((done) => {
        // init here
        done();
    });

    after(function () {
    });

    it('run Xcode with all default inputs', (done) => {
        setResponseFile('responseDefaultInputs.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'build');
        tr.setInput('configuration', ' $(Configuration)');
        tr.setInput('sdk', '$(SDK)');
        tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
        tr.setInput('scheme', '');
        tr.setInput('packageApp', 'true');
        tr.setInput('signMethod', 'file');
        tr.setInput('p12', '/user/build');
        tr.setInput('p12pwd', '');
        tr.setInput('provProfile', '/user/build');
        tr.setInput('removeProfile', 'false');
        tr.setInput('unlockDefaultKeychain', 'false');
        tr.setInput('defaultKeychainPassword', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        tr.setInput('args', '');
        tr.setInput('cwd', '/user/build');
        tr.setInput('outputPattern', 'output/$(SDK)/$(Configuration)');
        tr.setInput('xcodeDeveloperDir', '');
        tr.setInput('useXctool', 'false');
        tr.setInput('xctoolReporter', '');
        tr.setInput('publishJUnitResults', 'false');

        tr.run()
        .then(() => {
            assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
            assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration  $(Configuration) ' +
                    '-workspace /user/build/fun.xcodeproj/project.xcworkspace build ' +
                    'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
                    'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
                    'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
                    'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
                'xcodebuild for building the ios project/workspace should have been run.');
            assert(tr.ran('/home/bin/xcrun -sdk $(SDK) PackageApplication ' +
                    '-v /user/build/output/$(SDK)/$(Configuration)/build.sym/Release.iphoneos/fun.app ' +
                    '-o /user/build/output/$(SDK)/$(Configuration)/build.sym/Release.iphoneos/fun.ipa'),
                "xcrun to package the app and generate an .ipa should have been run.");
            assert(tr.invokedToolCount == 3, 'should have xcodebuild for version, xcodebuild for build and xcrun for packaging');
            assert(tr.resultWasSet, 'task should have set a result');
            assert(tr.stderr.length == 0, 'should not have written to stderr');
            assert(tr.succeeded, 'task should have succeeded');
            done();
        })
        .fail((err) => {
            done(err);
        })
    })
});