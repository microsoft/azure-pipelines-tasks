"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tmrm = require("azure-pipelines-task-lib/mock-run");
const path = require("path");
const util = require("./PipMockHelper");
let taskPath = path.join(__dirname, '..', 'pipauthenticatemain.js');
let tmr = new tmrm.TaskMockRunner(taskPath);
let pmh = new util.PipMockHelper(tmr);
tmr.setInput('artifactFeeds', 'TestFeed');
tmr.setInput('onlyAddExtraIndex', 'false');
let a = {
    "osType": {},
    "checkPath": {},
    "which": {},
    "exist": {},
    "stats": {}
};
tmr.setAnswers(a);
tmr.run();
