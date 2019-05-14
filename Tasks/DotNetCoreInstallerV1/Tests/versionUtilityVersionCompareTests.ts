'use strict';
import * as versionutilities from "../versionutilities";
import * as tl from 'vsts-task-lib/task';

if (process.env["__non_explicit__"] == "true") {
    let throwCount: number = 0;
    // try with non explicit version
    try {
        versionutilities.versionCompareFunction("2.2.104", "2.2.x");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        versionutilities.versionCompareFunction("2.x", "2.2.2");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        versionutilities.versionCompareFunction("", "2.2.104");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        versionutilities.versionCompareFunction("3.0.3-preview-727", "");
    }
    catch (ex) {
        throwCount++;
    }

    if (throwCount == 4) {
        throw tl.loc("FunctionThrewAsExpected");
    }
}
else {
    if (versionutilities.versionCompareFunction("2.2.104", "2.1.507") < 1) {
        throw "";
    }

    if (versionutilities.versionCompareFunction("3.0.0-preview-1", "3.0.0-preview-0") < 1) {
        throw "";
    }

    if (versionutilities.versionCompareFunction("2.2.104", "2.2.104") != 0) {
        throw "";
    }

    if (versionutilities.versionCompareFunction("3.1.104-preview1-324", "3.1.104-preview1-324") != 0) {
        throw "";
    }

    if (versionutilities.versionCompareFunction("2.1.400", "2.2.0") > -1) {
        throw "";
    }

    if (versionutilities.versionCompareFunction("1.14.1", "1.15.0-preview-1") > -1) {
        throw "";
    }

    console.log("FunctionGaveRightResult");
}