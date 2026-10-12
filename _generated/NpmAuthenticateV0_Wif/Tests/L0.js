"use strict";
// NpmAuthenticateV0 L0 test suite entrypoint
// Imports all grouped test files so mocha discovers them via a single target
Object.defineProperty(exports, "__esModule", { value: true });
require("./L0.Authentication");
require("./L0.InputValidation");
require("./L0.Telemetry");
require("./L0.Cleanup");
require("./L0.EndpointCredential");
require("./L0.ErrorPaths");
require("./L0.WIF");
// Unit tests (pure logic, no task runner)
require("./Unit");
