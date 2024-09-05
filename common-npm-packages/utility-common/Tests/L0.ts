import { runArgsSanitizerTelemetryTests, runArgsSanitizerTests } from './argsSanitizerTests';

describe('codeanalysis-common suite', () => {
    describe('Args sanitizer tests', runArgsSanitizerTests);

    describe('Args sanitizer telemetry tests', runArgsSanitizerTelemetryTests);
});
