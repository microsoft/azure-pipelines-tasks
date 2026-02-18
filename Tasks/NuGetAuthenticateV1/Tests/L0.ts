// NuGetAuthenticate L0 Test Suite Orchestrator
// This file imports all scenario-based test modules to run the complete test suite

// Scenario-based test modules (organized by feature/user journey)
import './L0.URLValidation';          // isValidFeed() URL validation tests
import './L0.InputValidation';        // Input validation and error handling
#if WIF
import './L0.WIF';                    // Workload Identity Federation scenarios
#endif
import './L0.ServiceConnections';     // External service connection scenarios
import './L0.CredentialProvider';     // Credential provider installation and configuration
import './L0.Telemetry';              // Telemetry and logging scenarios
