"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tmrm = require("azure-pipelines-task-lib/mock-run");
const path = require("path");
const util = require("./TwineMockHelper");
let taskPath = path.join(__dirname, '..', 'twineauthenticatemain.js');
let tmr = new tmrm.TaskMockRunner(taskPath);
let tmh = new util.TwineMockHelper(tmr);
tmr.setInput('artifactFeed', 'Test.Feed');
let a = {
    "osType": {},
    "checkPath": {},
    "which": {},
    "exist": {},
    "stats": {}
};
tmr.setAnswers(a);
tmr.run();
