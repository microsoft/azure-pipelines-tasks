// npm install mocha --save-dev
// typings install dt~mocha --save --global

import * as path from 'path';
import * as assert from 'assert';
import * as ttm from 'vsts-task-lib/mock-test';

describe('Xcode L0 Suite', function () {
    before(() => {

    });

    after(() => {

    });

    it('Xcode 7 create IPA with archive and auto export', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0ExportArchiveWithAuto.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.invokedToolCount == 11, 'should have run xcodebuild for version, build, archive and export and PlistBuddy to init and add export method.');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 7 create IPA with archive and export with specified method', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0ExportArchiveSpecify.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.invokedToolCount == 6, 'should have run xcodebuild for version, build, archive and export and PlistBuddy to init and add export method.');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 8 create IPA with export options plist', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0ExportArchiveWithPlist.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist /user/build/exportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.invokedToolCount == 4, 'should have run xcodebuild for version, build, archive and export.');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 8 create IPA with bad exportOptionsPlist path', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0ExportOptionsPlistBadPath.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme'),
            'xcodebuild archive should have been run to create the .xcarchive.');

        assert(tr.invokedToolCount == 3, 'should have run xcodebuild for version, build, and archive.');
        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.indexOf('vso[task.issue type=error;]loc_mock_ExportOptionsPlistInvalidFilePath') >= 0,
            'Build should show error indicating invalid Plist file path.');

        done();
    });

    it('Xcode create IPA with file paths for archive path and export path', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0FilePathForArchiveAndExportPath.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme.xcarchive'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/testipa.ipa -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.invokedToolCount == 6, 'should have run xcodebuild for version, build, archive and export and PlistBuddy to init and add export method.');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 7 create IPA with code signing identifiers', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0CreateIpaWithCodeSigningIdentifiers.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch ' +
            'CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE=testuuid'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme ' +
            'CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE=testuuid'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 8 automatic code signing with identifiers', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0Xcode8AutomaticSignWithIdentifiers.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch CODE_SIGN_STYLE=Automatic'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme CODE_SIGN_STYLE=Automatic'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 8 automatic signing with development team', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0Xcode8AutomaticSignWithDevTeam.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch ' +
            'CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=testDevTeamId'),
            'xcodebuild for building the ios project/workspace should have been run.');

        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) ' +
            '-archivePath /user/build/testScheme ' +
            'CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=testDevTeamId'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode archive and export with project path', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0XcodeArchiveExportProject.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-project /user/build/fun.xcodeproj -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch ' +
            'CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=testDevTeamId'),
            'xcodebuild for building the ios project/workspace should have been run.');

        //archive
        assert(tr.ran('/home/bin/xcodebuild -project /user/build/fun.xcodeproj -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) ' +
            '-archivePath /user/build/testScheme ' +
            'CODE_SIGN_STYLE=Automatic DEVELOPMENT_TEAM=testDevTeamId'),
            'xcodebuild archive should have been run to create the .xcarchive.');

        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 9 automatic signing with files', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0Xcode9AutomaticSignWithFiles.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch ' +
            'CODE_SIGN_STYLE=Automatic'),
            'xcodebuild for building the ios project/workspace should have been run.');

        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) ' +
            '-archivePath /user/build/testScheme ' +
            'CODE_SIGN_STYLE=Automatic'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 9 automatic signing with allowProvisioningUpdates', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0Xcode9AutomaticSignWithAllowProvisioningUpdates.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'DSTROOT=/user/build/output/$(SDK)/$(Configuration)/build.dst ' +
            'OBJROOT=/user/build/output/$(SDK)/$(Configuration)/build.obj ' +
            'SYMROOT=/user/build/output/$(SDK)/$(Configuration)/build.sym ' +
            'SHARED_PRECOMPS_DIR=/user/build/output/$(SDK)/$(Configuration)/build.pch ' +
            '-allowProvisioningUpdates CODE_SIGN_STYLE=Automatic'),
            'xcodebuild for building the ios project/workspace should have been run with -allowProvisioningUpdates.');

        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) ' +
            '-archivePath /user/build/testScheme ' +
            'CODE_SIGN_STYLE=Automatic -allowProvisioningUpdates'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist ' +
            '-allowProvisioningUpdates'),
            'xcodebuild exportArchive should have been run with -allowProvisioningUpdates to export the IPA from the .xcarchive');

        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 9 signing defaults to automatic, with auto export', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0XCode9SigningDefaultsToAutoWithAutoExport.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');

        //export prep
        assert(tr.ran("/usr/libexec/PlistBuddy -c Clear _XcodeTaskExportOptions.plist"),
            'PlistBuddy Clear should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add method string app-store _XcodeTaskExportOptions.plist"),
            'PlistBuddy add method should have run.');

        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive -archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run with -allowProvisioningUpdates to export the IPA from the .xcarchive');

        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 11, 'Should have run \"PlistBuddy -c Add...\" once, and 10 other command lines.');

        done();
    });

    it('Xcode 9 signing defaults to manual, with auto export', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0XCode9SigningDefaultsToManualWithAutoExport.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');

        //export prep
        assert(tr.ran("/usr/libexec/PlistBuddy -c Clear _XcodeTaskExportOptions.plist"),
            'PlistBuddy Clear should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add method string app-store _XcodeTaskExportOptions.plist"),
            'PlistBuddy add method should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add signingStyle string manual _XcodeTaskExportOptions.plist"),
            'PlistBuddy add signingStyle should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add provisioningProfiles dict _XcodeTaskExportOptions.plist"),
            'PlistBuddy add provisioningProfiles should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add provisioningProfiles:com.vsts.test.myApp string Bob _XcodeTaskExportOptions.plist"),
            'PlistBuddy add provisioningProfiles:com.vsts.test.myApp should have run.');

        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive -archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build/_XcodeTaskExport_testScheme -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run with -allowProvisioningUpdates to export the IPA from the .xcarchive');

        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount == 18, 'Should have run \"PlistBuddy -c Add...\" four times, and 14 other command lines.');

        done();
    });

    it('Task defaults - v4.127.0', (done: MochaDone) => {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0TaskDefaults_4.127.0.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        //scheme
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -list'),
            'xcodebuild for listing schemes should have been run.');

        //version
        assert(tr.ran('/home/bin/xcodebuild -version'),
            'xcodebuild for version should have been run.');

        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme funScheme build ' +
            'CODE_SIGNING_ALLOWED=NO'),
            'xcodebuild for building the ios project/workspace should have been run.');

        assert(tr.invokedToolCount == 3, 'should have run xcodebuild for scheme list, version and build.');
        assert(tr.stderr.length == 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });
});