import * as assert from "assert";
import * as path from "path";

import { MockTestRunner } from "azure-pipelines-task-lib/mock-test";

describe("Maven L0 Suite", function() {
    before(() => {});

    after(() => {});

    it("run maven with all default inputs and M2_HOME not set", function(done) {
        this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

        const testPath = path.join(__dirname, "L0DefaultsWithNoHomeSet.js");
        const testRunner = new MockTestRunner(testPath);

        testRunner.run();

        assert(testRunner.succeeded, "task should have succeeded");

        done();
    });
});
