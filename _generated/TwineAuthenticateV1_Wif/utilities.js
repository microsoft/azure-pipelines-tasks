"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPypircPath = getPypircPath;
const fs = require("fs");
const path = require("path");
const tl = require("azure-pipelines-task-lib/task");
function getPypircPath() {
    let pypircPath;
    if (tl.getVariable("PYPIRC_PATH")) {
        pypircPath = tl.getVariable("PYPIRC_PATH");
    }
    else {
        let tempPath = tl.getVariable("Agent.TempDirectory");
        tempPath = path.join(tempPath, "twineAuthenticate");
        tl.mkdirP(tempPath);
        let savePypircPath = fs.mkdtempSync(tempPath + path.sep);
        pypircPath = savePypircPath + path.sep + ".pypirc";
    }
    return pypircPath;
}
