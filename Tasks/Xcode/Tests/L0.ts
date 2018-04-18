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

    it('Xcode 7 create IPA with archive and auto export', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0ExportArchiveWithAuto.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.invokedToolCount === 11, 'should have run xcodebuild for version, build, archive and export and PlistBuddy to init and add export method.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 7 create IPA with archive and export with specified method', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0ExportArchiveSpecify.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.invokedToolCount === 6, 'should have run xcodebuild for version, build, archive and export and PlistBuddy to init and add export method.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 8 create IPA with export options plist', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0ExportArchiveWithPlist.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build -exportOptionsPlist /user/build/exportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.invokedToolCount === 4, 'should have run xcodebuild for version, build, archive and export.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 8 create IPA with bad exportOptionsPlist path', function (done: MochaDone) {
        this.timeout(1000);

        let tp = path.join(__dirname, 'L0ExportOptionsPlistBadPath.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme'),
            'xcodebuild archive should have been run to create the .xcarchive.');

        assert(tr.invokedToolCount === 3, 'should have run xcodebuild for version, build, and archive.');
        assert(tr.failed, 'task should have failed');
        assert(tr.stdout.indexOf('##vso[task.issue type=error;]Error: loc_mock_ExportOptionsPlistInvalidFilePath') >= 0,
            'Build should show error indicating invalid Plist file path.');

        done();
    });

    it('Xcode create IPA with file paths for archive path and export path', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0FilePathForArchiveAndExportPath.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build'),
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

        assert(tr.invokedToolCount === 6, 'should have run xcodebuild for version, build, archive and export and PlistBuddy to init and add export method.');
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 7 create IPA with code signing identifiers', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0CreateIpaWithCodeSigningIdentifiers.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE=testuuid PROVISIONING_PROFILE_SPECIFIER='),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme ' +
            'CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY=iPhone Developer: XcodeTask Tester (HE432Y3E2Q) PROVISIONING_PROFILE=testuuid PROVISIONING_PROFILE_SPECIFIER='),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 8 automatic code signing with identifiers', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0Xcode8AutomaticSignWithIdentifiers.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
            'CODE_SIGN_STYLE=Automatic'),
            'xcodebuild for building the ios project/workspace should have been run.');
        //archive
        assert(tr.ran('/home/bin/xcodebuild -workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme ' +
            'archive -sdk $(SDK) -configuration $(Configuration) -archivePath /user/build/testScheme CODE_SIGN_STYLE=Automatic'),
            'xcodebuild archive should have been run to create the .xcarchive.');
        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive ' +
            '-archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 8 automatic signing with development team', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0Xcode8AutomaticSignWithDevTeam.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
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
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode archive and export with project path', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0XcodeArchiveExportProject.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-project /user/build/fun.xcodeproj -scheme testScheme build ' +
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
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 9 automatic signing with files', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0Xcode9AutomaticSignWithFiles.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
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
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 9 automatic signing with allowProvisioningUpdates', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0Xcode9AutomaticSignWithAllowProvisioningUpdates.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');
        //build
        assert(tr.ran('/home/bin/xcodebuild -sdk $(SDK) -configuration $(Configuration) ' +
            '-workspace /user/build/fun.xcodeproj/project.xcworkspace -scheme testScheme build ' +
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
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist ' +
            '-allowProvisioningUpdates'),
            'xcodebuild exportArchive should have been run with -allowProvisioningUpdates to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Xcode 9 signing defaults to automatic, with auto export', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

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
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount === 14, 'Should have run \"PlistBuddy -c Add...\" once, and 13 other command lines.');

        done();
    });

    it('Xcode 9 signing defaults to manual, with auto export', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

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
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount === 21, 'Should have run \"PlistBuddy -c Add...\" four times, and 17 other command lines.');

        done();
    });

    it('Xcode 9 signing with auto export and cloud entitlement for production', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        const tp = path.join(__dirname, 'L0Xcode9ExportArchiveWithAutoAndCloudEntitlementForProduction.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');

        //export prep
        assert(tr.ran("/usr/libexec/PlistBuddy -c Clear _XcodeTaskExportOptions.plist"),
            'PlistBuddy Clear should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add method string app-store _XcodeTaskExportOptions.plist"),
            'PlistBuddy add method should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add iCloudContainerEnvironment string Production _XcodeTaskExportOptions.plist"),
            'PlistBuddy add cloud entitlement list should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add signingStyle string manual _XcodeTaskExportOptions.plist"),
            'PlistBuddy add signingStyle should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add provisioningProfiles dict _XcodeTaskExportOptions.plist"),
            'PlistBuddy add provisioningProfiles should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add provisioningProfiles:com.vsts.test.myApp string Bob _XcodeTaskExportOptions.plist"),
            'PlistBuddy add provisioningProfiles:com.vsts.test.myApp should have run.');

        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive -archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount === 22, 'Should have run \"PlistBuddy -c Add...\" four times, and 18 other command lines.');

        done();
    });

    it('Xcode 9 signing with auto export and cloud entitlement for development', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        const tp = path.join(__dirname, 'L0Xcode9ExportArchiveWithAutoAndCloudEntitlementForDevelopment.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');

        //export prep
        assert(tr.ran("/usr/libexec/PlistBuddy -c Clear _XcodeTaskExportOptions.plist"),
            'PlistBuddy Clear should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add method string development _XcodeTaskExportOptions.plist"),
            'PlistBuddy add method should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add iCloudContainerEnvironment string Development _XcodeTaskExportOptions.plist"),
            'PlistBuddy add cloud entitlement for Development should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add signingStyle string manual _XcodeTaskExportOptions.plist"),
            'PlistBuddy add signingStyle should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add provisioningProfiles dict _XcodeTaskExportOptions.plist"),
            'PlistBuddy add provisioningProfiles should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add provisioningProfiles:com.vsts.test.myApp string Bob _XcodeTaskExportOptions.plist"),
            'PlistBuddy add provisioningProfiles:com.vsts.test.myApp should have run.');

        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive -archivePath /user/build/testScheme.xcarchive ' +
            '-exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount === 21, 'Should have run \"PlistBuddy -c Add...\" four times, and 17 other command lines.');

        done();
    });

    it('Task defaults - v4.127.0', function (done: MochaDone) {
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
        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        done();
    });

    it('Test results should be published in postexecution to work even when Xcode test has failures', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0TestResultsPublishedInPostExecutionJob.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.succeeded, 'post xcode task should have succeeded');
        assert(tr.stdout.indexOf('##vso[results.publish type=JUnit;publishRunAttachments=true;resultFiles=/home/build/testbuild1/build/reports/junit.xml;]') > 0,
            'test result should have been published even when there are test errors');
        done();
    });

    it('Test results publishing should fail if xcpretty is not installed', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        let tp = path.join(__dirname, 'L0TestResultsPublishFailsIfXcprettyNotInstalled.js');
        let tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();

        assert(tr.stdout.indexOf('##vso[task.issue type=error;]loc_mock_XcprettyNotInstalled') > 0, 'error message should indicate that xcpretty has to be installed.')
        assert(tr.failed, 'post xcode task should have failed');
        done();
    });



    it('macOS auto export', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        const tp = path.join(__dirname, 'L0macOSAutoExport.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');

        //export prep
        assert(tr.ran("/usr/libexec/PlistBuddy -c Clear _XcodeTaskExportOptions.plist"),
            'PlistBuddy Clear should have run.');

        // macOS Developer ID provisioning profile from the developer portal.
        assert(tr.ran("/usr/libexec/PlistBuddy -c Add method string developer-id _XcodeTaskExportOptions.plist"),
            'PlistBuddy add method should have run.');

        // provisioning profile includes iCloudContainerEnvironment.
        assert(tr.ran("/usr/libexec/PlistBuddy -c Add iCloudContainerEnvironment string Production _XcodeTaskExportOptions.plist"),
            'PlistBuddy add cloud entitlement list should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add signingStyle string manual _XcodeTaskExportOptions.plist"),
            'PlistBuddy add signingStyle should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add provisioningProfiles dict _XcodeTaskExportOptions.plist"),
            'PlistBuddy add provisioningProfiles should have run.');

        assert(tr.ran("/usr/libexec/PlistBuddy -c Add provisioningProfiles:com.vsts.test.myApp string Bob _XcodeTaskExportOptions.plist"),
            'PlistBuddy add provisioningProfiles:com.vsts.test.myApp should have run.');

        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive -archivePath /user/build/testScheme.xcarchive'
            +' -exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');

        assert(tr.invokedToolCount === 21, 'Should have run \"PlistBuddy -c Add...\" five times, and 16 other command lines.');

        done();
    });

    it('macOS provisionless auto export', function (done: MochaDone) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        const tp = path.join(__dirname, 'L0macOSProvisionlessAutoExport.js');
        const tr: ttm.MockTestRunner = new ttm.MockTestRunner(tp);

        tr.run();
        //version
        assert(tr.ran('/home/bin/xcodebuild -version'), 'xcodebuild for version should have been run.');

        //export prep
        assert(tr.ran("/usr/libexec/PlistBuddy -c Clear _XcodeTaskExportOptions.plist"),
            'PlistBuddy Clear should have run. An empty exportOptions plist should be used when there\'s not an embedded provisioning profile.');

        //export
        assert(tr.ran('/home/bin/xcodebuild -exportArchive -archivePath /user/build/testScheme.xcarchive'
            +' -exportPath /user/build -exportOptionsPlist _XcodeTaskExportOptions.plist'),
            'xcodebuild exportArchive should have been run to export the IPA from the .xcarchive');

        assert(tr.stderr.length === 0, 'should not have written to stderr');
        assert(tr.succeeded, 'task should have succeeded');
        assert(tr.invokedToolCount === 6, 'Should have ran 6 command lines.');

        done();
    });
});