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

describe('DotNetCoreInstaller', function() {
    this.timeout(30000);
    before((done) => {
        done();
    });
    after(function() {
    });

    it("[VersionUtilities] versionCompareFunction should throw for non explicit versions or empty version strings", () => {
    });

    it("[VersionUtilities] versionCompareFunction should return 1, 0 or -1 when versionA is gt, eq or lt versionB", () => {
    });

    it("[VersionUtilities] compareChannelVersion function should throw when either or both channel versions are empty or are non numeric", () => {
    });

    it("[VersionUtilities] compareChannelVersion function should return 1, 0 or -1 when channelVersionA is gt, eq or lt channelVersionB", () => {
    });

    it("[VersionUtilities] getMatchingVersionFromList should return null for empty versionInfoList or versionInfoList elements having empty version", () => {
    });

    it("[VersionUtilities] getMatchingVersionFromList should return null when no version satisfying versionSpec can be found in list", () => {
    });

    it("[VersionUtilities] getMatchingVersionFromList should return heighest version for the spec when versionSpec is not exact version", () => {
    });

    it("[VersionUtilities] getMatchingVersionFromList should return null when versionSpec is exact version and the same version is not present in versionInfoList", () => {
    });

    it("[VersionUtilities] getMatchingVersionFromList should return exact version when versionSpec is exact version and the same version is present in versionInfoList", () => {
    });

    it("[VersionUtilities] ValidateVersionSpec should throw when majorversion have non numeric characters", () => {
    });

    it("[VersionUtilities] ValidateVersionSpec should throw when minor version have non numeric characters other than being only x", () => {
    });

    it("[VersionUtilities] ValidateVersionSpec should throw when patch version is present and minor version is x", () => {
    });

    it("[VersionUtilities] ValidateVersionSpec should throw when patch version is empty and minor version is numeric", () => {
    });

    it("[VersionUtilities] ValidateVersionSpec should throw when major or minor version is empty", () => {
    });

    it("[VersionUtilities] VersionParts constructor should throw when version fails validation", () => {
    });

    it("[VersionUtilities] VersionParts constructor return object instance with correct major, minor and patch version", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should throw if version for pacakge type can not be found, and error message should contain the package type", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should throw if getting channel fails", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return correct version info for a correct version spec", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return correct version info for a version which exists in a different channel of the same major version", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return latest version info in a major version for a versionSpec of type majorVersion.x", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return latest version info in a major.minor version for a versionSpec of type majorVersion.minorVersion.x", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return latest preview version info if includePreviewVersion is true and latest version is a preview version", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getVersionInfo should return latest version info even if includePreviewVersion is true but latest version is non preview", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should throw if VersionFilesData doesn't contain download URL", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should throw if download information object with RID matching OS, could not be found", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should throw if error encountered while detecting machine os", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should throw if zip package is not found for windows os", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should throw if tar.gz package is not found for linux os", () => {
    });

    it("[VersionFetcher.DotNetCoreVersionFetcher] getDownloadUrl should return correct download URL for matching OS", () => {
    });

    it("[VersionFetcher.VersionInfo] getRuntimeVersion should return correct runtime-version from sdk versionInfo object", () => {
    });

    it("[VersionFetcher.VersionInfo] getRuntimeVersion should return version for runtime versionInfo object", () => {
    });

    it("[VersionFetcher.VersionInfo] getRuntimeVersion should return empty string for sdk versionInfo object if runtime-version is not present", () => {
    });

    it("[VersionFetcher.Channel] constructor should throw if object passed doesn't contain channel-version or releasesJsonUrl, or contains invalid releasesJsonUrl", () => {
    });

    it("[VersionFetcher.Channel] constructor should pass if object contains channel-version and valid releasesJsonUrl", () => {
    });

    it("[VersionInstaller] constructor should throw if installationPath doesn't exist and cannot be created", () => {
    });

    it("[VersionInstaller] downloadAndInstall should throw if passed arguments are empty or doesn't contain version or downloadUrl is malformed", () => {
    });

    it("[VersionInstaller] downloadAndInstall should throw if downloading version from URL fails", () => {
    });

    it("[VersionInstaller] downloadAndInstall should throw if extracting downloaded package or copying folders into installation path fails.", () => {
    });

    it("[VersionInstaller] downloadAndInstall should not throw if copying root files from package into installationPath fails", () => {
    });

    it("[VersionInstaller] downloadAndInstall should only copy files from root folder if version being installed in the path is greater than all other already present", () => {
    });

    it("[VersionInstaller] downloadAndInstall should throw if creating version.complete file fails.", () => {
    });

    it("[VersionInstaller] downloadAndInstall should complete successfully on complete installation and create complete file in both sdk and runtime when sdk is installed and in runtime when only runtime is installed.", () => {
    });

    it("[VersionInstaller] isVersionInstalled should throw if version being checked is not explicit.", () => {
    });

    it("[VersionInstaller] isVersionInstalled should return false if either folder or file with name as version is not present inside sdk folder.", () => {
    });

    it("[VersionInstaller] isVersionInstalled should return false if either folder or file with name as version is not present inside runtime path.", () => {
    });

    it("[VersionInstaller] isVersionInstalled should return true if both folder or file with name as version is present inside sdk/runtime path.", () => {
    });

    it("[dotnetcoreinstaller] run should default to use $(Agent.ToolsDirectory)/dotnet as installation path if installationPath input is empty.", () => {
    });

    it("[dotnetcoreinstaller] run should throw if versionSpec is invalid.", () => {
    });

    it("[dotnetcoreinstaller] run should throw if versionInfo for the version spec could not be found.", () => {
    });

    it("[dotnetcoreinstaller] run should skip installation if version found in cache.", () => {
    });

    it("[dotnetcoreinstaller] run should always prepend installationPath & dotnet_root to PATH environment variable.", () => {
    });

    it("[dotnetcoreinstaller] run should not fail if globalToolPath could not be created or set.", () => {
    });

    it("[dotnetcoreinstaller] run should always set multilevel lookup environment variable and by default restrict if input is not present.", () => {
    });
});
