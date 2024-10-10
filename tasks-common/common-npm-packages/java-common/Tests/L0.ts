import { findJavaHomeTest } from "./L0FindJavaHome";
import { publishJavaTelemetryTest } from "./L0PublishJavaTelemetry";

describe("artifacts-common suite", async function() {
    describe("findJavaHome", findJavaHomeTest);

    describe("publishJavaTelemetry", publishJavaTelemetryTest);
});
