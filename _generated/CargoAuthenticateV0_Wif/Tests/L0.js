"use strict";
// CargoAuthenticate L0 Test Suite Orchestrator
// This file imports all scenario-based test modules to run the complete test suite
Object.defineProperty(exports, "__esModule", { value: true });
// Scenario-based test modules (organized by user journey/feature)
require("./L0.InternalAuth"); // System.AccessToken authentication scenarios
require("./L0.ExternalAuth"); // External service connection scenarios
require("./L0.TokenAuth"); // crates.io Token authentication scenarios
require("./L0.TOMLParsing"); // Configuration file parsing scenarios
require("./L0.MixedAuth"); // Mixed authentication scenarios
require("./L0.WIF"); // Workload Identity Federation scenarios
require("./L0.Telemetry"); // Telemetry and logging scenarios
