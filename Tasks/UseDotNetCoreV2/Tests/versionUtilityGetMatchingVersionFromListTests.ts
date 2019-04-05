'use strict';
import * as versionutilities from "../versionutilities";
import { VersionInfo } from "../models";

if (process.env["__empty__"] == "true") {
    let throwCount: number = 0;
    // empty version info list

    if (versionutilities.getMatchingVersionFromList([], "2.x") != null) {
        throw ""
    }

    // form the version info list with preview versions as well
    let versionInfoList: VersionInfo[] = [];
    ["3.0.100", "3.1.0-preview-850"].forEach((version) => {
        var temp = new VersionInfo(JSON.parse(`{"version": "${version}", "files": []}`), "sdk");
        versionInfoList.push(temp);
    });

    // version info list with no version matching the version spec, with includePreviewVersion as false
    if (versionutilities.getMatchingVersionFromList(versionInfoList, "3.1.x", false) != null) {
        throw "";
    }


    // version info list with no version matching the version spec, with includePreviewVersion as true
    if (versionutilities.getMatchingVersionFromList(versionInfoList, "2.9.x", true) != null) {
        throw "";
    }

    // version info list with version exactly equal to version not present (in this case version spec is an exact version), , with includePreviewVersion as false
    if (versionutilities.getMatchingVersionFromList(versionInfoList, "3.1.0", false) != null) {
        throw "";
    }

    // version info list with version exactly equal to version not present (in this case version spec is an exact version), with includePreviewVersion as true
    if (versionutilities.getMatchingVersionFromList(versionInfoList, "3.1.0", true) != null) {
        throw "";
    }

    console.log("FunctionReturnedNull")
}
else {
    // form the version info list with preview versions as well
    let versionInfoList: VersionInfo[] = [];
    ["3.0.100", "3.0.200-preview-850", "3.1.100", "3.1.101-preview-850"].forEach((version) => {
        var temp = new VersionInfo(JSON.parse(`{"version": "${version}", "files": []}`), "sdk");
        versionInfoList.push(temp);
    });

    // should return heighest non preview version in major version 3
    if (versionutilities.getMatchingVersionFromList(versionInfoList, "3.x", false).getVersion() != "3.1.100") {
        throw "";
    }

    // should return heighest version (may be preview as well) in major version 3
    if (versionutilities.getMatchingVersionFromList(versionInfoList, "3.x", true).getVersion() != "3.1.101-preview-850") {
        throw "";
    }

    // should return heighest non preview version in major version 3 and minor version 0
    if (versionutilities.getMatchingVersionFromList(versionInfoList, "3.0.x", false).getVersion() != "3.0.100") {
        throw "";
    }

    // should return heighest version (may be preview as well) in major version 3 and minor version 0
    if (versionutilities.getMatchingVersionFromList(versionInfoList, "3.0.x", true).getVersion() != "3.0.200-preview-850") {
        throw "";
    }

    // should return exact version from list
    if (versionutilities.getMatchingVersionFromList(versionInfoList, "3.0.100", false).getVersion() != "3.0.100") {
        throw "";
    }

    // should return exact version from list even if includePreviewVersion is false and the version spec is preview
    if (versionutilities.getMatchingVersionFromList(versionInfoList, "3.0.200-preview-850", false).getVersion() != "3.0.200-preview-850") {
        throw "";
    }

    console.log("FuctionReturnedCorrectVersion");
}