"use strict";
import { applyRollForwardPolicy } from "../versionutilities";

if (process.env["__case__"] == "returnsCorrectSpecs") {
    // disable: exact version, no change
    if (applyRollForwardPolicy("6.0.403", "disable") !== "6.0.403") {
        throw `disable should return exact version. Got: ${applyRollForwardPolicy("6.0.403", "disable")}`;
    }

    // patch: same feature band, latest patch => >=6.0.400 <6.0.500
    if (applyRollForwardPolicy("6.0.403", "patch") !== ">=6.0.400 <6.0.500") {
        throw `patch should return feature band range. Got: ${applyRollForwardPolicy("6.0.403", "patch")}`;
    }

    // latestPatch: same as patch
    if (
        applyRollForwardPolicy("6.0.403", "latestPatch") !== ">=6.0.400 <6.0.500"
    ) {
        throw `latestPatch should return feature band range. Got: ${applyRollForwardPolicy("6.0.403", "latestPatch")}`;
    }

    // patch with feature band 1: 8.0.100 => >=8.0.100 <8.0.200
    if (applyRollForwardPolicy("8.0.100", "patch") !== ">=8.0.100 <8.0.200") {
        throw `patch for 8.0.100 should return >=8.0.100 <8.0.200. Got: ${applyRollForwardPolicy("8.0.100", "patch")}`;
    }

    // feature / latestFeature: major.minor.x
    if (applyRollForwardPolicy("6.0.403", "feature") !== "6.0.x") {
        throw `feature should return major.minor.x. Got: ${applyRollForwardPolicy("6.0.403", "feature")}`;
    }

    if (applyRollForwardPolicy("6.0.403", "latestFeature") !== "6.0.x") {
        throw `latestFeature should return major.minor.x. Got: ${applyRollForwardPolicy("6.0.403", "latestFeature")}`;
    }

    // minor / latestMinor: major.x
    if (applyRollForwardPolicy("6.0.403", "minor") !== "6.x") {
        throw `minor should return major.x. Got: ${applyRollForwardPolicy("6.0.403", "minor")}`;
    }

    if (applyRollForwardPolicy("6.0.403", "latestMinor") !== "6.x") {
        throw `latestMinor should return major.x. Got: ${applyRollForwardPolicy("6.0.403", "latestMinor")}`;
    }

    // major / latestMajor: major.x (caller handles cross-channel search)
    if (applyRollForwardPolicy("6.0.403", "major") !== "6.x") {
        throw `major should return major.x. Got: ${applyRollForwardPolicy("6.0.403", "major")}`;
    }

    if (applyRollForwardPolicy("6.0.403", "latestMajor") !== "6.x") {
        throw `latestMajor should return major.x. Got: ${applyRollForwardPolicy("6.0.403", "latestMajor")}`;
    }

    console.log("RollForwardSpecsCorrect");
}

if (process.env["__case__"] == "edgeCases") {
    // Unknown policy returns version unchanged
    if (applyRollForwardPolicy("6.0.403", "unknownPolicy") !== "6.0.403") {
        throw `Unknown policy should return original version. Got: ${applyRollForwardPolicy("6.0.403", "unknownPolicy")}`;
    }

    // Version with prerelease tag
    if (
        applyRollForwardPolicy("7.0.100-preview.1", "latestFeature") !== "7.0.x"
    ) {
        throw `latestFeature with prerelease should return major.minor.x. Got: ${applyRollForwardPolicy("7.0.100-preview.1", "latestFeature")}`;
    }

    // Version with only 2 parts returns unchanged
    if (applyRollForwardPolicy("6.0", "latestFeature") !== "6.0") {
        throw `Two-part version should return unchanged. Got: ${applyRollForwardPolicy("6.0", "latestFeature")}`;
    }

    // Feature band 0: 8.0.003 => >=8.0.0 <8.0.100
    if (applyRollForwardPolicy("8.0.3", "patch") !== ">=8.0.0 <8.0.100") {
        throw `patch for 8.0.3 (feature band 0) should return >=8.0.0 <8.0.100. Got: ${applyRollForwardPolicy("8.0.3", "patch")}`;
    }

    console.log("EdgeCasesCorrect");
}
