// CargoAuthenticate L0 Test Suite Orchestrator
// This file imports all scenario-based test modules to run the complete test suite

// Scenario-based test modules (organized by user journey/feature)
import './L0.InternalAuth';     // System.AccessToken authentication scenarios
import './L0.ExternalAuth';     // External service connection scenarios
import './L0.TokenAuth';        // crates.io Token authentication scenarios
import './L0.TOMLParsing';      // Configuration file parsing scenarios
import './L0.MixedAuth';        // Mixed authentication scenarios
#if WIF
import './L0.WIF';              // Workload Identity Federation scenarios
#endif
import './L0.Telemetry';        // Telemetry and logging scenarios
