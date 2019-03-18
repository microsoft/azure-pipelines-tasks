'use strict';
import { VersionInfo } from "../models";
import * as tl from 'vsts-task-lib/task';


if (VersionInfo.getRuntimeVersion(null, "") != "") {
    throw "";
}

if (VersionInfo.getRuntimeVersion(null, "") != "") {
    throw "";
}

let versionInfo = new VersionInfo();
versionInfo.version = "";

if (process.env["__sdk_runtime__"] == "true") {
    if (VersionInfo.getRuntimeVersion(versionInfo, "sdk") != "") {
        throw "";
    }

    versionInfo.version = "2.2.100"
    if (VersionInfo.getRuntimeVersion(versionInfo, "sdk") != "") {
        throw "";
    }

    versionInfo.version = "2.2.104";
    versionInfo["runtime-version"] = "2.2.4";
    if (VersionInfo.getRuntimeVersion(versionInfo, "sdk") != "2.2.4") {
        throw "";
    }

    versionInfo.version = "";
    versionInfo["runtime-version"] = "2.2.4";
    if (VersionInfo.getRuntimeVersion(null, "") != "") {
        throw "";
    }

    console.log(tl.loc("RuntimeVersionsReturnedForSdkAreCorrect"));
}
else {
    if (VersionInfo.getRuntimeVersion(versionInfo, "runtime") != "") {
        throw "";
    }

    versionInfo.version = "2.2.100"
    if (VersionInfo.getRuntimeVersion(versionInfo, "runtime") != "2.2.100") {
        throw "";
    }

    versionInfo.version = "2.2.104";
    versionInfo["runtime-version"] = "2.2.4";
    if (VersionInfo.getRuntimeVersion(versionInfo, "runtime") != "2.2.104") {
        throw "";
    }

    versionInfo.version = "";
    versionInfo["runtime-version"] = "2.2.4";
    if (VersionInfo.getRuntimeVersion(null, "") != "") {
        throw "";
    }

    console.log(tl.loc("RuntimeVersionsReturnedAreCorrect"));
}