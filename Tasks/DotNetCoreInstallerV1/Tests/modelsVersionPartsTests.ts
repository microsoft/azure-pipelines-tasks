'use strict';
import { VersionParts } from "../models";
import * as tl from 'vsts-task-lib/task';

if (process.env["__invalid_versionparts__"] == "true") {
    let throwCount: number = 0;
    // try with non explicit version
    try {
        new VersionParts("2a.x");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new VersionParts("2.2x");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new VersionParts("2.x.2");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new VersionParts("2.2.");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new VersionParts("2.2");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new VersionParts("");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new VersionParts("..");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        new VersionParts("2.2.2fs");
    }
    catch (ex) {
        throwCount++;
    }

    if (throwCount == 8) {
        throw tl.loc("FunctionThrewAsExpected");
    }
}
else {
    let versionParts = new VersionParts("2.x")
    if (versionParts.majorVersion != "2" || versionParts.minorVersion != "x" || versionParts.patchVersion != "") {
        throw tl.loc("first")
    }

    versionParts = new VersionParts("2.100.x");
    if (versionParts.majorVersion != "2" || versionParts.minorVersion != "100" || versionParts.patchVersion != "x") {
        throw tl.loc("second")
    }

    versionParts = new VersionParts("2.100.1");
    if (versionParts.majorVersion != "2" || versionParts.minorVersion != "100" || versionParts.patchVersion != "1") {
        throw tl.loc("third")
    }

    versionParts = new VersionParts("2.100.13-preview");
    if (versionParts.majorVersion != "2" || versionParts.minorVersion != "100" || versionParts.patchVersion != "13-preview") {
        throw tl.loc("fourth")
    }

    versionParts = new VersionParts("2.100.14-rc1-431");
    if (versionParts.majorVersion != "2" || versionParts.minorVersion != "100" || versionParts.patchVersion != "14-rc1-431") {
        throw tl.loc("fifth")
    }

    console.log("VersionPartsCreatedSuccessfully");
}