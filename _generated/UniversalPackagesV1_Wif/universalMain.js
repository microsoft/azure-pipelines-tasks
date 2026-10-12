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
const path = require("path");
const tl = require("azure-pipelines-task-lib");
const universalDownload = require("./universalDownload");
const universalPublish = require("./universalPublish");
const UniversalPackageContext_1 = require("./UniversalPackageContext");
const artifactToolResolver_1 = require("./artifactToolResolver");
const helpers = require("./universalPackageHelpers");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        tl.setResourcePath(path.join(__dirname, "task.json"));
        // Validate server type
        if (!(yield helpers.validateServerType()))
            return;
        // Create context and get inputs
        const context = new UniversalPackageContext_1.UniversalPackageContext();
        // Validate version inputs
        if (!helpers.validateVersionInputs(context))
            return;
        // Set up authentication
        if (!(yield helpers.trySetAuth(context)))
            return;
        // Parse feed input
        helpers.setFeed(context);
        // Resolve artifact tool path from pre-job cache or download inline
        let artifactToolPath;
        try {
            artifactToolPath = yield (0, artifactToolResolver_1.getArtifactToolPath)();
        }
        catch (error) {
            tl.setResult(tl.TaskResult.Failed, tl.loc("Error_FailedToGetArtifactTool", (_a = error === null || error === void 0 ? void 0 : error.message) !== null && _a !== void 0 ? _a : String(error)));
            return;
        }
        context.artifactToolPath = artifactToolPath;
        helpers.logArtifactToolTelemetry(context);
        // Calling the command. download/publish
        switch (context.command) {
            case UniversalPackageContext_1.OperationType.Download:
                yield universalDownload.run(context);
                break;
            case UniversalPackageContext_1.OperationType.Publish:
                yield universalPublish.run(context);
                break;
            default:
                tl.setResult(tl.TaskResult.Failed, tl.loc("Error_CommandNotRecognized", context.command));
                return;
        }
    });
}
main();
