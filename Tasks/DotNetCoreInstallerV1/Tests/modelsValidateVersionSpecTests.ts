'use strict';
import { VersionParts } from "../models";
import * as tl from 'vsts-task-lib/task';

if (process.env["__invalid_versionspec__"] == "true") {
    let throwCount: number = 0;
    // try with non explicit version
    try {
        VersionParts.ValidateVersionSpec("2a.x");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        VersionParts.ValidateVersionSpec("2.2x");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        VersionParts.ValidateVersionSpec("2.x.2");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        VersionParts.ValidateVersionSpec("2.2.");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        VersionParts.ValidateVersionSpec("2.2");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        VersionParts.ValidateVersionSpec("");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        VersionParts.ValidateVersionSpec("..");
    }
    catch (ex) {
        throwCount++;
    }

    try {
        VersionParts.ValidateVersionSpec("2.2.2fs");
    }
    catch (ex) {
        throwCount++;
    }

    if (throwCount == 8) {
        throw tl.loc("FunctionThrewAsExpected");
    }
}
else {
    if (VersionParts.ValidateVersionSpec("2.x") != true) {
        throw ""
    }

    if (VersionParts.ValidateVersionSpec("2.100.x") != true) {
        throw ""
    }

    if (VersionParts.ValidateVersionSpec("2.100.1") != true) {
        throw ""
    }

    if (VersionParts.ValidateVersionSpec("2.100.13-preview") != true) {
        throw ""
    }

    if (VersionParts.ValidateVersionSpec("2.100.14-rc1-431") != true) {
        throw ""
    }

    console.log("VersionsValidatedSuccessfully");
}