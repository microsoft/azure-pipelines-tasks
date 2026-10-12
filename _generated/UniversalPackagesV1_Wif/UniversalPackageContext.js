"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UniversalPackageContext = exports.OperationType = void 0;
const tl = require("azure-pipelines-task-lib");
var OperationType;
(function (OperationType) {
    OperationType["Download"] = "download";
    OperationType["Publish"] = "publish";
})(OperationType || (exports.OperationType = OperationType = {}));
class UniversalPackageContext {
    constructor() {
        this.adoServiceConnection = tl.getInput("adoServiceConnection", false);
        this.feedUrl = tl.getInput("feedUrl", false);
        this.projectAndFeed = tl.getInput("feed", true);
        this.packageName = tl.getInput("packageName", true);
        this.packageVersion = tl.getInput("packageVersion", false);
        this.versionIncrement = tl.getInput("versionIncrement", false);
        this.directory = tl.getInput("directory", true);
        this.packageDescription = tl.getInput("packageDescription", false);
        this.command = tl.getInput("command", true);
        this.pipelineCollectionUri = tl.getVariable("System.TeamFoundationCollectionUri");
        this.buildServiceAccountId = tl.getVariable("Build.BuildServiceAccountId");
        // Set verbosity based on System.Debug: Debug for verbose output, Information for normal output
        this.verbosity = tl.getVariable("System.Debug") === "true" ? "Debug" : "Information";
    }
}
exports.UniversalPackageContext = UniversalPackageContext;
