'use strict';
import { VersionInfo } from "../models";
import * as tl from 'vsts-task-lib/task';

let versionInfo = new VersionInfo(JSON.parse(`{"version":"", "files":""}`));
if (versionInfo.getRuntimeVersion("") != "") {
    throw "";
}

versionInfo.version = "";

if (process.env["__sdk_runtime__"] == "true") {
    if (versionInfo.getRuntimeVersion("sdk") != "") {
        throw "";
    }

    versionInfo.version = "2.2.100"
    if (versionInfo.getRuntimeVersion("sdk") != "") {
        throw "";
    }

    versionInfo.version = "2.2.104";
    versionInfo["runtime-version"] = "2.2.4";
    if (versionInfo.getRuntimeVersion("sdk") != "2.2.4") {
        throw "";
    }

    versionInfo.version = "";
    versionInfo["runtime-version"] = "2.2.4";
    if (versionInfo.getRuntimeVersion("") != "") {
        throw "";
    }

    console.log(tl.loc("RuntimeVersionsReturnedForSdkAreCorrect"));
}
else {
    if (versionInfo.getRuntimeVersion("runtime") != "") {
        throw "";
    }

    versionInfo.version = "2.2.100"
    if (versionInfo.getRuntimeVersion("runtime") != "2.2.100") {
        throw "";
    }

    versionInfo.version = "2.2.104";
    versionInfo["runtime-version"] = "2.2.4";
    if (versionInfo.getRuntimeVersion("runtime") != "2.2.104") {
        throw "";
    }

    versionInfo.version = "";
    versionInfo["runtime-version"] = "2.2.4";
    if (versionInfo.getRuntimeVersion("") != "") {
        throw "";
    }

    console.log(tl.loc("RuntimeVersionsReturnedAreCorrect"));
}