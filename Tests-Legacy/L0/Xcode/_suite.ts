/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>

import assert = require('assert');
import trm = require('../../lib/taskRunner');
import path = require('path');
import os = require('os');

var isWin = /^win/.test(process.platform);

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
        tr.setInput('configuration', '$(Configuration)');
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
            assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
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

    it('run Xcode with xctool as build tool', (done) => {
        setResponseFile('responseXctool.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'build');
        tr.setInput('configuration', '$(Configuration)');
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
        tr.setInput('useXctool', 'true');
        tr.setInput('xctoolReporter', '');
        tr.setInput('publishJUnitResults', 'false');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xctool -version'), 'xctool for version should have been run.');

                assert(tr.ran('/home/bin/xctool -sdk $(SDK) -configuration $(Configuration) ' +
                        '-workspace /user/build/fun.xcodeproj/project.xcworkspace build ' +
                        'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
                        'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
                        'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
                        'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
                    'xctool for building the ios project/workspace should have been run.');

                assert(tr.ran('/home/bin/xcrun -sdk $(SDK) PackageApplication ' +
                        '-v /user/build/output/$(SDK)/$(Configuration)/build.sym/Release.iphoneos/fun.app ' +
                        '-o /user/build/output/$(SDK)/$(Configuration)/build.sym/Release.iphoneos/fun.ipa'),
                    "xcrun to package the app and generate an .ipa should have been run.");

                assert(tr.invokedToolCount == 3, 'should have xctool for version, xctool for build and xcrun for packaging');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            })
    })

    it('run Xcode with project and no workspace', (done) => {
        setResponseFile('responseProject.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'build');
        tr.setInput('configuration', '$(Configuration)');
        tr.setInput('sdk', '$(SDK)');
        tr.setInput('xcWorkspacePath', '/user/build');
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
        tr.setInput('args', '-project test.xcodeproj');
        tr.setInput('cwd', '/user/build');
        tr.setInput('outputPattern', 'output/$(SDK)/$(Configuration)');
        tr.setInput('xcodeDeveloperDir', '');
        tr.setInput('useXctool', 'false');
        tr.setInput('xctoolReporter', '');
        tr.setInput('publishJUnitResults', 'false');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
                assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
                        'build DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
                        'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
                        'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
                        'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch ' +
                        '-project test.xcodeproj'),
                    'xcodebuild for building the ios project should have been run.');
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

    it('run Xcode build with test action, publish test results', (done) => {
        setResponseFile('responseXctool.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'test');
        tr.setInput('configuration', '$(Configuration)');
        tr.setInput('sdk', '$(SDK)');
        tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
        tr.setInput('scheme', '');
        tr.setInput('packageApp', 'false');
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
        tr.setInput('useXctool', 'true');
        tr.setInput('xctoolReporter', 'junit:test-results.xml');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xctool -version'), 'xctool for version should have been run.');

                assert(tr.ran('/home/bin/xctool -sdk $(SDK) -configuration $(Configuration) ' +
                        '-workspace /user/build/fun.xcodeproj/project.xcworkspace ' +
                        '-reporter plain -reporter junit:test-results.xml test ' +
                        'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
                        'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
                        'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
                    'xctool for building the ios project/workspace should have been run.');

                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;publishRunAttachments=true;resultFiles=\/user\/build\/test-results.xml;\]/) > 0,
                    'publish test results should have been called');

                assert(tr.invokedToolCount == 2, 'should have xctool for version, xctool for build and xcrun for packaging');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            })
    })

    it('run Xcode build with test action, publish test results by searching for result files with a pattern', (done) => {
        setResponseFile('responseXctool.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'test');
        tr.setInput('configuration', '$(Configuration)');
        tr.setInput('sdk', '$(SDK)');
        tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
        tr.setInput('scheme', '');
        tr.setInput('packageApp', 'false');
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
        tr.setInput('useXctool', 'true');
        tr.setInput('xctoolReporter', 'junit:**/*test*.xml');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xctool -version'), 'xctool for version should have been run.');

                assert(tr.ran('/home/bin/xctool -sdk $(SDK) -configuration $(Configuration) ' +
                        '-workspace /user/build/fun.xcodeproj/project.xcworkspace ' +
                        '-reporter plain -reporter junit:**/*test*.xml test ' +
                        'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
                        'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
                        'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
                    'xctool for building the ios project/workspace should have been run.');

                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;publishRunAttachments=true;resultFiles=\/user\/build\/test1\/test-results.xml,\/user\/build\/test2\/testresults.xml;\]/) > 0,
                    'publish test results should have been called');

                assert(tr.invokedToolCount == 2, 'should have xctool for version, xctool for build and xcrun for packaging');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            })
    })

    it('run Xcode build with test action, without specifying xctool test report format', (done) => {
        setResponseFile('responseXctool.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'test');
        tr.setInput('configuration', '$(Configuration)');
        tr.setInput('sdk', '$(SDK)');
        tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
        tr.setInput('scheme', '');
        tr.setInput('packageApp', 'false');
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
        tr.setInput('useXctool', 'true');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xctool -version'), 'xctool for version should have been run.');

                assert(tr.ran('/home/bin/xctool -sdk $(SDK) -configuration $(Configuration) ' +
                        '-workspace /user/build/fun.xcodeproj/project.xcworkspace test ' +
                        'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
                        'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
                        'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
                        'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
                    'xctool for running tests on the ios project/workspace should have been run.');

                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;publishRunAttachments=true;resultFiles=\/user\/build\/test-results.xml;\]/) < 0,
                    'publish test results should not have been called');

                assert(tr.stdout.search(/[When using xctool, specify the xctool reporter format to publish test results. No results will be published.]/) >=0,
                    'warning should have been provided that test results cannot be published with xctool without the test reporter format');

                assert(tr.invokedToolCount == 2, 'should have xctool for version, xctool for test');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            })
    })

    it('run Xcode build with test action, with xcpretty', (done) => {
        setResponseFile('responseXcpretty.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'test');
        tr.setInput('configuration', '$(Configuration)');
        tr.setInput('sdk', '$(SDK)');
        tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
        tr.setInput('scheme', '');
        tr.setInput('packageApp', 'false');
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
        tr.setInput('xcodeDeveloperDir', '');
        tr.setInput('outputPattern', 'output/$(SDK)/$(Configuration)');
        tr.setInput('useXctool', 'false');
        tr.setInput('useXcpretty', 'true');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');

                assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
                        '-workspace /user/build/fun.xcodeproj/project.xcworkspace test ' +
                        'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
                        'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
                        'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
                        'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch ' +
                        '| /home/bin/xcpretty -r junit --no-color'),
                    'xcodebuild for running tests in the ios project/workspace should have been run with xcpretty formatting.');

                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;publishRunAttachments=true;resultFiles=\/user\/build\/build\/reports\/junit.xml;\]/) >= 0,
                    'publish test results should have been called');

                assert(tr.invokedToolCount == 2, 'should have xcodebuild for version, xcodebuild for test with xcpretty');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            })
    })

    it('run Xcode build with test action, without choosing xcpretty', (done) => {
        setResponseFile('responseXcpretty.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'test');
        tr.setInput('configuration', '$(Configuration)');
        tr.setInput('sdk', '$(SDK)');
        tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
        tr.setInput('scheme', '');
        tr.setInput('packageApp', 'false');
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
        tr.setInput('xcodeDeveloperDir', '');
        tr.setInput('outputPattern', 'output/$(SDK)/$(Configuration)');
        tr.setInput('useXctool', 'false');
        tr.setInput('useXcpretty', 'false');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');

                assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
                        '-workspace /user/build/fun.xcodeproj/project.xcworkspace test ' +
                        'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
                        'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
                        'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
                        'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
                    'xcodebuild for running tests in the ios project/workspace should have been run without xcpretty formatting.');

                assert(tr.stdout.search(/##vso\[results.publish type=JUnit;publishRunAttachments=true;resultFiles=\/user\/build\/build\/reports\/junit.xml;\]/) < 0,
                    'publish test results should not have been called');

                assert(tr.stdout.search(/[When using xcodebuild, check 'Use xcpretty' to publish test results. No results will be published.]/) >=0,
                    'warning should have been provided that test results cannot be published with xcodebuild if xcpretty is not used.');

                assert(tr.invokedToolCount == 2, 'should have xcodebuild for version, xcodebuild for test with xcpretty');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            })
    })

    it('run Xcode build, signing with P12 and provisioning profile', (done) => {
        if(isWin) {
            //test fails on windows with error in string.indexOf returning -1 in iOS signing code
            //skip running on windows till root cause is identified
            done();
        } else {
            setResponseFile('responseSigningFile.json');

            var tr = new trm.TaskRunner('Xcode', true, true);
            tr.setInput('actions', 'build');
            tr.setInput('configuration', '$(Configuration)');
            tr.setInput('sdk', '$(SDK)');
            tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
            tr.setInput('scheme', 'fun');
            tr.setInput('packageApp', 'false');
            tr.setInput('signMethod', 'file');
            tr.setInput('p12', '/user/build/cert.p12');
            tr.setInput('p12pwd', 'p12password');
            tr.setInput('provProfile', '/user/build/testuuid.mobileprovision');
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
                    assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch OTHER_CODE_SIGN_FLAGS=--keychain=/user/build/_xcodetasktmp.keychain CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE=testuuid'),
                        'xcodebuild for building the ios project/workspace should have been run with signing options.');
                    assert(tr.resultWasSet, 'task should have set a result');
                    assert(tr.stderr.length == 0, 'should not have written to stderr');
                    assert(tr.succeeded, 'task should have succeeded');
                    done();
                })
                .fail((err) => {
                    done(err);
                })
        }
    })

    it('run Xcode build, signing with P12 only, no provisioning profile', (done) => {
        if(isWin) {
            //test fails on windows with error in string.indexOf returning -1 in iOS signing code
            //skip running on windows till root cause is identified
            done();
        } else {
            setResponseFile('responseSigningFile.json');

            var tr = new trm.TaskRunner('Xcode', true, true);
            tr.setInput('actions', 'build');
            tr.setInput('configuration', '$(Configuration)');
            tr.setInput('sdk', '$(SDK)');
            tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
            tr.setInput('scheme', 'fun');
            tr.setInput('packageApp', 'false');
            tr.setInput('signMethod', 'file');
            tr.setInput('p12', '/user/build/cert.p12');
            tr.setInput('p12pwd', 'p12password');
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
                    assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch OTHER_CODE_SIGN_FLAGS=--keychain=/user/build/_xcodetasktmp.keychain CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q)'),
                        'xcodebuild for building the ios project/workspace should have been run with signing options with P12 only, no provisioning profile.');
                    assert(tr.resultWasSet, 'task should have set a result');
                    assert(tr.stderr.length == 0, 'should not have written to stderr');
                    assert(tr.succeeded, 'task should have succeeded');
                    done();
                })
                .fail((err) => {
                    done(err);
                })
        }
    })

    it('run Xcode build, signing with provisioning profile only, no P12', (done) => {
        setResponseFile('responseSigningFile.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'build');
        tr.setInput('configuration', '$(Configuration)');
        tr.setInput('sdk', '$(SDK)');
        tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
        tr.setInput('scheme', 'fun');
        tr.setInput('packageApp', 'false');
        tr.setInput('signMethod', 'file');
        tr.setInput('p12', '/user/build');
        tr.setInput('p12pwd', '');
        tr.setInput('provProfile', '/user/build/testuuid.mobileprovision');
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
                assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch PROVISIONING_PROFILE=testuuid'),
                    'xcodebuild for building the ios project/workspace should have been run with signing options with provisioning profile only.');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            })
    })


    it('run Xcode build, signing with identifiers', (done) => {
        setResponseFile('responseSigningId.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'build');
        tr.setInput('configuration', '$(Configuration)');
        tr.setInput('sdk', '$(SDK)');
        tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
        tr.setInput('scheme', 'fun');
        tr.setInput('packageApp', 'false');
        tr.setInput('signMethod', 'id');
        tr.setInput('p12', '/user/build');
        tr.setInput('p12pwd', '');
        tr.setInput('provProfile', '/user/build');
        tr.setInput('removeProfile', 'false');
        tr.setInput('unlockDefaultKeychain', 'true');
        tr.setInput('defaultKeychainPassword', 'defaultKeychainPWD');
        tr.setInput('iosSigningIdentity', 'testSignIdentity');
        tr.setInput('provProfileUuid', 'testUUID');
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
                assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch CODE_SIGN_IDENTITY=testSignIdentity PROVISIONING_PROFILE=testUUID'),
                    'xcodebuild for building the ios project/workspace should have been run with signing options.');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr');
                assert(tr.succeeded, 'task should have succeeded');
                done();
            })
            .fail((err) => {
                done(err);
            })
    })

    it('run Xcode with required args not specified', (done) => {
     setResponseFile('responseErrorArgs.json');

     var tr = new trm.TaskRunner('Xcode', true, true);
     tr.setInput('actions', '');
     tr.setInput('configuration', '');
     tr.setInput('sdk', '');
     tr.setInput('xcWorkspacePath', '/user/build');
     tr.setInput('scheme', '');
     tr.setInput('packageApp', 'false');
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
     tr.setInput('outputPattern', '');
     tr.setInput('xcodeDeveloperDir', '');
     tr.setInput('useXctool', 'false');
     tr.setInput('xctoolReporter', '');
     tr.setInput('publishJUnitResults', 'false');

     tr.run()
         .then(() => {
             assert(tr.stdout.search(/Input required: outputPattern/) > 0, 'Error should be shown if outputPath is not specified.');
             tr.setInput('outputPattern', 'output/$(SDK)/$(Configuration)');
             tr.run()
                 .then(() => {
                     assert(tr.stdout.search(/Input required: actions/) > 0, 'Error should be shown if actions are not specified.');
                     tr.setInput('actions', 'build');
                     tr.run()
                        .then(() => {
                             assert(tr.succeeded, 'Task should have run successfully with required inputs');
                             done();
                         })
                        .fail((err) => {
                             done(err);
                         })
                 })
                 .fail((err) => {
                     done(err);
                 })
         })
         .fail((err) => {
             done(err);
         })
    })

    it('run Xcode with optional args specified', (done) => {
        setResponseFile('responseOptionalArgs.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'clean build');
        tr.setInput('configuration', 'Release');
        tr.setInput('sdk', 'iphone');
        tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
        tr.setInput('scheme', 'fun');
        tr.setInput('packageApp', 'false');
        tr.setInput('signMethod', 'file');
        tr.setInput('p12', '/user/build');
        tr.setInput('p12pwd', '');
        tr.setInput('provProfile', '/user/build');
        tr.setInput('removeProfile', 'false');
        tr.setInput('unlockDefaultKeychain', 'false');
        tr.setInput('defaultKeychainPassword', '');
        tr.setInput('iosSigningIdentity', '');
        tr.setInput('provProfileUuid', '');
        tr.setInput('args', '-exportArchive -exportPath /user/build/output/iphone/release');
        tr.setInput('cwd', '/user/build');
        tr.setInput('outputPattern', 'output/iphone/release');
        tr.setInput('xcodeDeveloperDir', '/Applications/Xcode5');
        tr.setInput('useXctool', 'false');
        tr.setInput('xctoolReporter', '');
        tr.setInput('publishJUnitResults', 'false');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
                assert(tr.ran('/home/bin/xcodebuild -sdk iphone -configuration Release -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun clean build DSTROOT=/user/build/output/iphone/release/build.dst OBJROOT=/user/build/output/iphone/release/build.obj SYMROOT=/user/build/output/iphone/release/build.sym SHARED_PRECOMPS_DIR=/user/build/output/iphone/release/build.pch -exportArchive -exportPath /user/build/output/iphone/release'),
                    'xcodebuild for building the ios project/workspace should have been run with all optional args.');
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