"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const tl = require("azure-pipelines-task-lib/task");
const telemetry = require("azure-pipelines-tasks-utility-common/telemetry");
const path = require("path");
const artifactToolResolver_1 = require("./artifactToolResolver");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        tl.setResourcePath(path.join(__dirname, "task.json"));
        let artifactToolPath = "";
        try {
            artifactToolPath = yield (0, artifactToolResolver_1.getArtifactToolPath)();
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_FailedToGetArtifactTool", (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : String(error)));
            return;
        }
        finally {
            logPreJobTelemetry(artifactToolPath);
        }
    });
}
function logPreJobTelemetry(artifactToolPath) {
    try {
        telemetry.emitTelemetry("Packaging", "UniversalPackagesV1", {
            "command": tl.getInput("command"),
            "artifactToolPath": artifactToolPath,
            "overrideArtifactToolPath": tl.getVariable("UPack.OverrideArtifactToolPath") || "",
            "System.TeamFoundationCollectionUri": tl.getVariable("System.TeamFoundationCollectionUri"),
        });
    }
    catch (err) {
        tl.debug(tl.loc("Debug_FailedToEmitPreJobTelemetry", err.message));
    }
}
run();
