'use strict';
import { VersionInfo } from "../models";
import * as tl from 'vsts-task-lib/task';

if (process.env["__sdk_runtime__"] == "true") {
    let versionInfo = new VersionInfo(JSON.parse(`{"version":"2.1.1", "files": []}`), "sdk");
    if (versionInfo.getRuntimeVersion() != "") {
        throw "";
    }

    versionInfo = new VersionInfo(JSON.parse(`{"version":"2.1.1", "runtime-version":"2.2.4", "files": []}`), "sdk");
    if (versionInfo.getRuntimeVersion() != "2.2.4") {
        throw "";
    }

    console.log(tl.loc("RuntimeVersionsReturnedForSdkAreCorrect"));
}
else {
    let versionInfo = new VersionInfo(JSON.parse(`{"version":"2.1.1", "files": []}`), "runtime");
    if (versionInfo.getRuntimeVersion() != "2.1.1") {
        throw "";
    }

    versionInfo = new VersionInfo(JSON.parse(`{"version":"2.1.1", "runtime-version": "2.2.4", "files": []}`), "runtime");
    if (versionInfo.getRuntimeVersion() != "2.1.1") {
        throw "";
    }

    console.log(tl.loc("RuntimeVersionsReturnedAreCorrect"));
}