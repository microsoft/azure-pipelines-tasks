'use strict';
import * as versionutilities from "../versionutilities";
import * as tl from 'vsts-task-lib/task';

if (process.env["__non_explicit__"] == "true") {
    let throwCount: number = 0;
    // try with non explicit version
    try {
        versionutilities.compareChannelVersion("2.2", "2.x");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        versionutilities.compareChannelVersion("2.x", "2.1");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        versionutilities.compareChannelVersion("", "3.14");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        versionutilities.compareChannelVersion("1.127", "");
    }
    catch (ex) {
        throwCount++;
    }

    if (throwCount == 4) {
        throw tl.loc("FunctionThrewAsExpected");
    }
}
else {
    if (versionutilities.compareChannelVersion("3.0", "2.999") < 1) {
        throw "";
    }

    if (versionutilities.compareChannelVersion("3.547", "3.547") != 0) {
        throw "";
    }

    if (versionutilities.compareChannelVersion("2.100", "2.200") > -1) {
        throw "";
    }

    console.log("FunctionGaveRightResult");
}