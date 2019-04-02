'use strict';

const assert = require('assert');
const tl = require('vsts-task-lib');
const ttm = require('vsts-task-lib/mock-test');
const path = require('path');

function setResponseFile(name) {
    process.env['MOCK_RESPONSES'] = path.join(__dirname, name);
}

function runValidations(validator: () => void, tr, done) {
    try {
        validator();
        done();
    }
    catch (error) {
        console.log("STDERR", tr.stderr);
        console.log("STDOUT", tr.stdout);
        done(error);
    }
}

describe('DotNetCoreInstaller', function () {
    this.timeout(30000);
    before((done) => {
        done();
    });
    after(function () {
    });

    it("[VersionUtilities] versionCompareFunction should throw for non explicit versions or empty version strings", (done) => {
        process.env["__non_explicit__"] = "true"
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionUtilityVersionCompareTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("should have thrown and failed"));
            assert(tr.stdout.indexOf("FunctionThrewAsExpected") > -1, "Should have thrown as versions are not explicit and are empty strings.");
        }, tr, done);
    });

    it("[VersionUtilities] versionCompareFunction should return 1, 0 or -1 when versionA is gt, eq or lt versionB", (done) => {
        process.env["__non_explicit__"] = "false";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionUtilityVersionCompareTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have succeeded"));
            assert(tr.stdout.indexOf("FunctionGaveRightResult") > -1, "Should have given right results for all cases.");
        }, tr, done);
    });

    it("[VersionUtilities] compareChannelVersion function should throw when either or both channel versions are empty or are non numeric", (done) => {
        process.env["__non_explicit__"] = "true"
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionUtilityVersionCompareTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("should have thrown and failed"));
            assert(tr.stdout.indexOf("FunctionThrewAsExpected") > -1, "Should have thrown as versions are not explicit and are empty strings.");
        }, tr, done);
    });

    it("[VersionUtilities] compareChannelVersion function should return 1, 0 or -1 when channelVersionA is gt, eq or lt channelVersionB", (done) => {
        process.env["__non_explicit__"] = "false";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionUtilityChannelVersionCompareTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have succeeded"));
            assert(tr.stdout.indexOf("FunctionGaveRightResult") > -1, "Should have given right results for all cases.");
        }, tr, done);
    });

    it("[VersionUtilities] getMatchingVersionFromList should return null for empty versionInfoList, versionInfoList elements having empty version or no matching version found in list while toggling includePreviewVersionsValue", (done) => {
        process.env["__empty__"] = "true"
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionUtilityGetMatchingVersionFromListTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have succeeded"));
            assert(tr.stdout.indexOf("FunctionReturnedNull") > -1, "Should have returned null for all cases and print the message.");
        }, tr, done);
    });

    it("[VersionUtilities] getMatchingVersionFromList should return heighest version for the spec when versionSpec is not exact version", (done) => {
        process.env["__empty__"] = "false"
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionUtilityGetMatchingVersionFromListTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have succeeded"));
            assert(tr.stdout.indexOf("FuctionReturnedCorrectVersion") > -1, "Should have returned null for all cases and print the message.");
        }, tr, done);
    });

    it("[Models.VersionParts] constructor should throw when version fails validation", (done) => {
        process.env["__invalid_versionparts__"] = "true";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "modelsVersionPartsTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed"));
            assert(tr.stdout.indexOf("FunctionThrewAsExpected") > -1, "Should have thrown for all invalid version specs.");
        }, tr, done);
    });

    it("[Models.VersionParts] constructor return object instance with correct major, minor and patch version", (done) => {
        process.env["__invalid_versionparts__"] = "false";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "modelsVersionPartsTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have returned right objects"));
            assert(tr.stdout.indexOf("VersionPartsCreatedSuccessfully") > -1, "Should have returned the correct objects and print the statement.");
        }, tr, done);
    });

    it("[Models.Channel] constructor should throw if object passed doesn't contain channel-version or releasesJsonUrl, or contains invalid releasesJsonUrl", (done) => {
        process.env["__invalid_channelobject__"] = "true";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "modelsChannelTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed for incorrect objects."));
            assert(tr.stdout.indexOf("FunctionThrewAsExpected") > -1, "Should have thrown error in all cases.");
        }, tr, done);
    });

    it("[Models.Channel] constructor should pass if object contains channel-version and valid releasesJsonUrl", (done) => {
        process.env["__invalid_channelobject__"] = "false";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "modelsChannelTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have successfully created channel objects."));
            assert(tr.stdout.indexOf("ChannelCreatedSuccessfully") > -1, "Should have returned the correct objects and print the statement.");
        }, tr, done);
    });

    it("[Models.VersionInfo] getRuntimeVersion should return correct runtime-version from sdk versionInfo object", (done) => {
        process.env["__sdk_runtime__"] = "true";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "modelsGetRuntimeVersionTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have successfully returned runtime versions for sdk package type."));
            assert(tr.stdout.indexOf("RuntimeVersionsReturnedForSdkAreCorrect") > -1, "Should have returned correct runtime versions for all cases of packageType sdk.");
        }, tr, done);
    });

    it("[Models.VersionInfo] getRuntimeVersion should return version for runtime versionInfo object", (done) => {
        process.env["__sdk_runtime__"] = "false";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "modelsGetRuntimeVersionTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have successfully returned runtime versions for runtime package type."));
            assert(tr.stdout.indexOf("RuntimeVersionsReturnedAreCorrect") > -1, "Should have returned correct runtime versions for all cases of packageType runtime.");
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should throw if version for pacakge type can not be found, and error message should contain the package type", (done) => {
        process.env["__failat__"] = "versionnotfound";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetVersionInfoFailTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as the wanted version of package type can not be found."));
            assert(tr.stdout.indexOf("VersionNotFound") > -1, "Should have thrown version not found exception.");
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should throw if getting channel fails", (done) => {
        process.env["__failat__"] = "channelfetch";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetVersionInfoFailTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as channels could not be fetched."));
            assert(tr.stdout.indexOf("ExceptionWhileDownloadOrReadReleasesIndex") > -1, "Should have thrown exception and returned.");
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return correct version info for a correct version spec", (done) => {
        process.env["__versionspec__"] = "2.2.103";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetVersionInfoTestsCorrect.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have returned the correct version info."));
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return correct version info for a version which exists in a different channel of the same major version", (done) => {
        process.env["__versionspec__"] = "2.1.104";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetVersionInfoTestsCorrect.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have returned the correct version info."));
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return latest version info in a major version for a versionSpec of type majorVersion.x", (done) => {
        process.env["__versionspec__"] = "2.x";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetVersionInfoTestsCorrect.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have returned the correct version info."));
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return latest version info in a major.minor version for a versionSpec of type majorVersion.minorVersion.x", (done) => {
        process.env["__versionspec__"] = "2.2.x";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetVersionInfoTestsCorrect.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have returned the correct version info."));
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return latest preview version info if includePreviewVersion is true and latest version is a preview version", (done) => {
        process.env["__versionspec__"] = "2.2.x";
        process.env["__inlcudepreviewversion__"] = "true";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetVersionInfoTestsCorrect.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have returned the correct version info."));
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return latest version info even if includePreviewVersion is true but latest version is non preview", (done) => {
        process.env["__versionSpec__"] = "2.3.x";
        process.env["__inlcudepreviewversion__"] = "true";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetVersionInfoTestsCorrect.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have returned the correct version info."));
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should throw if VersionFilesData doesn't contain download URL", (done) => {
        process.env["__ostype__"] = "win";
        process.env["__getmachineosfail__"] = "false";
        process.env["__versioninfo__"] = `{"version":"2.2.104", "files": [{"name":"winpackage.zip", "rid":"win-x64", "url": ""}]}`;
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetDownloadUrlFailTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as download URL is missing."));
            assert(tr.stdout.indexOf("DownloadUrlForMatchingOsNotFound") > 0, ("Should have thrown the error message as download URL is not present."))
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should throw if download information object with RID matching OS, could not be found", (done) => {
        process.env["__ostype__"] = "win";
        process.env["__getmachineosfail__"] = "false";
        process.env["__versioninfo__"] = `{"version":"2.2.104", "files": [{"name": "linux.tar.gz", "rid":"linux-x64", "url": ""}, {"name": "win.zip", "rid":"win-x86", "url": ""}]}`;
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetDownloadUrlFailTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as download URL is missing."));
            assert(tr.stdout.indexOf("DownloadUrlForMatchingOsNotFound") > 0, ("Should have thrown the error message as download URL is not present."))
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should throw if error encountered while detecting machine os", (done) => {
        process.env["__ostype__"] = "win";
        process.env["__getmachineosfail__"] = "true";
        process.env["__versioninfo__"] = `{"version":"2.2.104", "files": [{"name": "linux.tar.gz", "rid":"linux-x64", "url": ""}, {"name":"winpackage.zip", "rid":"win-x86", "url": ""}]}`;
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetDownloadUrlFailTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as machine os could not be detected."));
            assert(tr.stdout.indexOf("getMachinePlatformFailed") > 0, ("Should have thrown the error message as getMachineOs script execution was not successful."))
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should throw if zip package is not found for windows os", (done) => {
        process.env["__ostype__"] = "win";
        process.env["__getmachineosfail__"] = "false";
        process.env["__versioninfo__"] = `{"version":"2.2.104", "files": [{"name": "winpacakage.exe", "rid":"win-x64", "url": "https://path.to/file.exe"}, {"name": "winpacakage2.exe", "rid":"win-x86", "url": "https://path.to/file.exe"}]}`;
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetDownloadUrlFailTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as download URL is missing."));
            assert(tr.stdout.indexOf("DownloadUrlForMatchingOsNotFound") > 0, ("Should have thrown the error message as download url of zip could not be found for windows."))
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should throw if tar.gz package is not found for non windows os", (done) => {
        process.env["__ostype__"] = "osx";
        process.env["__getmachineosfail__"] = "false";
        process.env["__versioninfo__"] = `{"version":"2.2.104", "files": [{"name": "linux.tar", "rid":"linux-x64", "url": "https://path.to/file.pkg"}, {"name": "osx.pkg", "rid":"osx-x64", "url": "https://path.to/file.pkg"}]}`;
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetDownloadUrlFailTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as download URL is missing."));
            assert(tr.stdout.indexOf("DownloadUrlForMatchingOsNotFound") > 0, ("Should have thrown the error message as download url of tar file could not be found for mac os."))
        }, tr, done);
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should return correct download URL for matching OS", (done) => {
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionFetcherGetDownloadUrlPassTests.js"));
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have passed as download URL for all windows, linux and osx are available for correct rid."));
            assert(tr.stdout.indexOf("CorrectDownloadUrlsSuccessfullyReturnedForAllOs") > 0, ("Should have printed success message on receiving correct urls for all os's."))
        }, tr, done);
    });

    it("[VersionInstaller] constructor should throw if installationPath doesn't exist and cannot be created", (done) => {
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as the installation path doesn't exist and cannot be created or the process doesn't have permission over it."))
        }, tr, done);
    });

    it("[VersionInstaller] downloadAndInstall should throw if passed arguments are empty or doesn't contain version or downloadUrl is malformed", (done) => {
        process.env["__case__"] = "urlerror";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerDownloadAndInstallTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as the arguments passed are not correct."));
            assert(tr.stdout.indexOf("VersionCanNotBeDownloadedFromUrl") > -1, "Should have thrown this error: VersionCanNotBeDownloadedFromUrl");
            assert(tr.stdout.lastIndexOf("VersionCanNotBeDownloadedFromUrl") > tr.stdout.indexOf("VersionCanNotBeDownloadedFromUrl"), "Should have thrown this error: VersionCanNotBeDownloadedFromUrl");
        }, tr, done);
    });

    it("[VersionInstaller] downloadAndInstall should throw if downloading version from URL fails", (done) => {
        process.env["__case__"] = "downloaderror";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerDownloadAndInstallTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as downloading the package from url did not complete."));
            assert(tr.stdout.indexOf("CouldNotDownload") > -1, "Should have thrown this error: CouldNotDownload");
        }, tr, done);
    });

    it("[VersionInstaller] downloadAndInstall should throw if extracting downloaded package or copying folders into installation path fails.", (done) => {
        process.env["__case__"] = "extracterror";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerDownloadAndInstallTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as extraction of package was not successfull."));
            assert(tr.stdout.indexOf("FailedWhileExtractingPacakge") > -1, "Should have thrown this error: FailedWhileExtractingPacakge");
        }, tr, done);
    });

    it("[VersionInstaller] downloadAndInstall should not throw if root folders were successfully copied but copying root files from package into installationPath failed", (done) => {
        process.env["__case__"] = "filecopyerror";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerDownloadAndInstallTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have passed."));
            assert(tr.stdout.indexOf("FailedToCopyTopLevelFiles") > -1, "Should not have caused function failure when root file's copying failed.");
            assert(tr.stdout.indexOf("SuccessfullyInstalled") > -1, "Function should have completed successfully.");
        }, tr, done);
    });

    it("[VersionInstaller] downloadAndInstall should not copy files from root folder if version being installed in the path is not greater than all other already present or runtime is being installed", (done) => {
        process.env["__case__"] = "conditionalfilecopy";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerDownloadAndInstallTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have passed."));
            assert(tr.stdout.lastIndexOf("CopyingFilesIntoPath [ 'installationPath' ]") == tr.stdout.indexOf("CopyingFilesIntoPath [ 'installationPath' ]"), "Should have copied root files in only one case where the version being installed is latest among already installed ones.");
        }, tr, done);
    });

    it("[VersionInstaller] downloadAndInstall should throw if creating version.complete file fails.", (done) => {
        process.env["__case__"] = "versioncompletefileerror";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerDownloadAndInstallTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed as creating completion markup file failed for package."));
            assert(tr.stdout.indexOf("CreatingInstallationCompeleteFile") > -1, "Should have tried creating the file.");
            assert(tr.stdout.indexOf("FailedWhileInstallingVersionAtPath") > -1, "Should have thrown this error as the parent error.");
        }, tr, done);
    });

    it("[VersionInstaller] downloadAndInstall should complete successfully on complete installation and create complete file in both sdk and runtime when sdk is installed and in runtime when only runtime is installed.", (done) => {
        process.env["__case__"] = "successfullinstall";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerDownloadAndInstallTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have passed."));
            assert(tr.stdout.indexOf("SuccessfullyInstalled") > -1, "Should have SuccessfullyInstalled.")
        }, tr, done);
    });

    it("[VersionInstaller] isVersionInstalled should throw if version being checked is not explicit.", (done) => {
        process.env["__case__"] = "nonexplicit";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerIsVersionInstalledTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed."));
            assert(tr.stdout.indexOf("ExplicitVersionRequired") > -1, "Should have printed ExplicitVersionRequired.")
        }, tr, done);
    });

    it("[VersionInstaller] isVersionInstalled should return false if either folder or file with name as version is not present inside sdk/runtime folder.", (done) => {
        process.env["__case__"] = "folderorfilemissing";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerIsVersionInstalledTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have returned false without failure."));
            assert(tr.stdout.indexOf("VersionFoundInCache") <= -1, "Should not have found any version in cache as either file or folder for that version were missing");
        }, tr, done);
    });

    it("[VersionInstaller] isVersionInstalled should return true if both folder or file with name as version is present inside sdk/runtime path.", (done) => {
        process.env["__case__"] = "success";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "versionInstallerIsVersionInstalledTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have returned false without failure."));
            assert(tr.stdout.indexOf("VersionFoundInCache") > -1, "Should not have found any version in cache as either file or folder for that version were missing");
        }, tr, done);
    });

    it("[dotnetcoreinstaller] run should throw if versionSpec is invalid.", (done) => {
        process.env["__case__"] = "matchingversionnotfound";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "dotnetcoreInstallerTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == false, ("Should have failed."));
            assert(tr.stdout.indexOf("MatchingVersionNotFound") > -1, "Should not have thrown this message as versionInfo for a matching version could not be found.");
        }, tr, done);
    });

    it("[dotnetcoreinstaller] run should skip installation if version found in cache but should prepend all the required paths and should also use $(Agent.ToolsDirectory)/dotnet as installation when input is missing.", (done) => {
        process.env["__case__"] = "skipinstallation";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "dotnetcoreInstallerTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have passed."));
            assert(tr.stdout.indexOf("PrependingInstallationPath") > -1, "Should have prepended installation path");
            assert(tr.stdout.indexOf("PrependGlobalToolPath") > -1, "Should have printed this message as addDotNetCoreToolPath function should have been called.");
            assert(tr.stdout.indexOf("PrependingGlobalToolPath") > -1, "Should have prepended global tool path");
            assert(tr.stdout.indexOf("DownloadAndInstallCalled") == -1, "Should not have printed this message as DownloadAndInstall function should not have been called.");
        }, tr, done);
    });

    it("[dotnetcoreinstaller] run should install if version is not found in cache and prepend the required paths.", (done) => {
        process.env["__case__"] = "installversion";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "dotnetcoreInstallerTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have passed."));
            assert(tr.stdout.indexOf("PrependingInstallationPath") > -1, "Should have prepended installation path");
            assert(tr.stdout.indexOf("PrependGlobalToolPath") > -1, "Should have printed this message as addDotNetCoreToolPath function should have been called.");
            assert(tr.stdout.indexOf("PrependingGlobalToolPath") > -1, "Should have prepended global tool path");
            assert(tr.stdout.indexOf("DownloadAndInstallCalled") > -1, "Should have printed this message as DownloadAndInstall function should have been called.");
        }, tr, done);
    });

    it("[dotnetcoreinstaller] run should not fail if globalToolPath could not be created or set.", (done) => {
        process.env["__case__"] = "globaltoolpathfailure";
        let tr = new ttm.MockTestRunner(path.join(__dirname, "dotnetcoreInstallerTests.js"))
        tr.run();
        runValidations(() => {
            assert(tr.succeeded == true, ("Should have passed."));
            assert(tr.stdout.indexOf("PrependingInstallationPath") > -1, "Should have prepended installation path");
            assert(tr.stdout.indexOf("PrependGlobalToolPath") > -1, "Should have printed this message as addDotNetCoreToolPath function should have been called.");
            assert(tr.stdout.indexOf("ErrorWhileSettingDotNetToolPath") > -1, "Should have printed this message as error must have been encountered while setting GlobalToolPath.");
        }, tr, done);
    });
});
