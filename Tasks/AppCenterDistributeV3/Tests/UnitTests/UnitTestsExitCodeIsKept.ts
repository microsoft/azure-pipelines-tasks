import { assertByExitCode } from "./TestHelpers";

// Verify that exit code doesn't overwritten
assertByExitCode.equal(true, false);
