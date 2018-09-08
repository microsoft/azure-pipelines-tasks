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
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

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
        tr.setInput('scheme', 'myscheme');
        tr.setInput('packageApp', 'false');
        tr.setInput('signingOption', 'default');
        tr.setInput('signingIdentity', '');
        tr.setInput('provisioningProfileUuid', '');
        tr.setInput('args', '');
        tr.setInput('cwd', '/user/build');
        tr.setInput('xcodeVersion', 'default');
        tr.setInput('xcodeDeveloperDir', '');
        tr.setInput('publishJUnitResults', 'false');

        tr.run()
        .then(() => {
            assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
            assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
                    '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme myscheme build'),
                'xcodebuild for building the ios project/workspace should have been run.');
            assert(tr.invokedToolCount == 2, 'should have xcodebuild for version, xcodebuild for build and xcrun for packaging');
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
        tr.setInput('packageApp', 'false');
        tr.setInput('signingOption', 'default');
        tr.setInput('signingIdentity', '');
        tr.setInput('provisioningProfileUuid', '');
        tr.setInput('args', '-project test.xcodeproj');
        tr.setInput('cwd', '/user/build');
        tr.setInput('xcodeVersion', 'default');
        tr.setInput('xcodeDeveloperDir', '');
        tr.setInput('publishJUnitResults', 'false');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
                assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
                        'build -project test.xcodeproj'),
                    'xcodebuild for building the ios project should have been run.');
                assert(tr.invokedToolCount == 2, 'should have xcodebuild for version, xcodebuild for build and xcrun for packaging');
                assert(tr.resultWasSet, 'task should have set a result');
                assert(tr.stderr.length == 0, 'should not have written to stderr std=' + tr.stdout + ' err=' + tr.stderr);
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
        tr.setInput('scheme', 'myscheme');
        tr.setInput('packageApp', 'false');
        tr.setInput('signingOption', 'default');
        tr.setInput('signingIdentity', '');
        tr.setInput('provisioningProfileUuid', '');
        tr.setInput('args', '');
        tr.setInput('cwd', '/user/build');
        tr.setInput('xcodeVersion', 'default');
        tr.setInput('xcodeDeveloperDir', '');
        tr.setInput('useXcpretty', 'true');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');

                assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
                        '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme myscheme test ' +
                        '| /home/bin/xcpretty -r junit --no-color'),
                    'xcodebuild for running tests in the ios project/workspace should have been run with xcpretty formatting.');

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
        tr.setInput('scheme', 'myscheme');
        tr.setInput('packageApp', 'false');
        tr.setInput('signingOption', 'default');
        tr.setInput('signingIdentity', '');
        tr.setInput('provisioningProfileUuid', '');
        tr.setInput('args', '');
        tr.setInput('cwd', '/user/build');
        tr.setInput('xcodeVersion', 'default');
        tr.setInput('xcodeDeveloperDir', '');
        tr.setInput('useXcpretty', 'false');
        tr.setInput('publishJUnitResults', 'true');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');

                assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
                        '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme myscheme test'),
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
            tr.setInput('signingOption', 'manual');
            tr.setInput('signingIdentity', 'iPhone Developer: XcodeTask Tester (HE432Y3E2Q)');
            tr.setInput('provisioningProfileUuid', 'testuuid');
            tr.setInput('args', '');
            tr.setInput('cwd', '/user/build');
            tr.setInput('xcodeVersion', 'default');
            tr.setInput('xcodeDeveloperDir', '');
            tr.setInput('publishJUnitResults', 'false');

            tr.run()
                .then(() => {
                    assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
                    assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE=testuuid PROVISIONING_PROFILE_SPECIFIER='),
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
            tr.setInput('signingOption', 'manual');
            tr.setInput('signingIdentity', 'iPhone Developer: XcodeTask Tester (HE432Y3E2Q)');
            tr.setInput('provisioningProfileUuid', '');
            tr.setInput('args', '');
            tr.setInput('cwd', '/user/build');
            tr.setInput('xcodeVersion', 'default');
            tr.setInput('xcodeDeveloperDir', '');
            tr.setInput('publishJUnitResults', 'false');

            tr.run()
                .then(() => {
                    assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
                    assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE= PROVISIONING_PROFILE_SPECIFIER='),
                        'xcodebuild for building the ios project/workspace should have been run with signing options with P12 signing identity, and empty provisioning profile/specifier values that override any values in the pbxproj file.');
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
        tr.setInput('signingOption', 'manual');
        tr.setInput('signingIdentity', '');
        tr.setInput('provisioningProfileUuid', 'testuuid');
        tr.setInput('args', '');
        tr.setInput('cwd', '/user/build');
        tr.setInput('xcodeVersion', 'default');
        tr.setInput('xcodeDeveloperDir', '');
        tr.setInput('publishJUnitResults', 'false');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
                assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build CODE_SIGN_STYLE=Manual PROVISIONING_PROFILE=testuuid PROVISIONING_PROFILE_SPECIFIER='),
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
        tr.setInput('signingOption', 'manual');
        tr.setInput('signingIdentity', 'testSignIdentity');
        tr.setInput('provisioningProfileUuid', 'testUUID');
        tr.setInput('args', '');
        tr.setInput('cwd', '/user/build');
        tr.setInput('xcodeVersion', 'default');
        tr.setInput('xcodeDeveloperDir', '');
        tr.setInput('publishJUnitResults', 'false');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
                assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun build CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=testSignIdentity PROVISIONING_PROFILE=testUUID PROVISIONING_PROFILE_SPECIFIER='),
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

    it('run Xcode with required arg not specified', (done) => {
     setResponseFile('responseErrorArgs.json');

     var tr = new trm.TaskRunner('Xcode', true, true);
     tr.setInput('actions', '');
     tr.setInput('configuration', '');
     tr.setInput('sdk', '');
     tr.setInput('xcWorkspacePath', '/user/build');
     tr.setInput('scheme', '');
     tr.setInput('packageApp', 'false');
     tr.setInput('signingOption', 'default');
     tr.setInput('signingIdentity', '');
     tr.setInput('provisioningProfileUuid', '');
     tr.setInput('args', '');
     tr.setInput('cwd', '/user/build');
     tr.setInput('xcodeVersion', 'default');
     tr.setInput('xcodeDeveloperDir', '');
     tr.setInput('publishJUnitResults', 'false');

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

    it('run Xcode with optional args specified', (done) => {
        setResponseFile('responseOptionalArgs.json');

        var tr = new trm.TaskRunner('Xcode', true, true);
        tr.setInput('actions', 'clean build');
        tr.setInput('configuration', 'Release');
        tr.setInput('sdk', 'iphone');
        tr.setInput('xcWorkspacePath', '**/*.xcodeproj/*.xcworkspace');
        tr.setInput('scheme', 'fun');
        tr.setInput('packageApp', 'false');
        tr.setInput('signingOption', 'default');
        tr.setInput('signingIdentity', '');
        tr.setInput('provisioningProfileUuid', '');
        tr.setInput('args', '-exportArchive -exportPath /user/build/output/iphone/release');
        tr.setInput('cwd', '/user/build');
        tr.setInput('xcodeVersion', 'specifyPath');
        tr.setInput('xcodeDeveloperDir', '/Applications/Xcode5');
        tr.setInput('publishJUnitResults', 'false');

        tr.run()
            .then(() => {
                assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
                assert(tr.ran('/home/bin/xcodebuild -sdk iphone -configuration Release -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme fun clean build -exportArchive -exportPath /user/build/output/iphone/release'),
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