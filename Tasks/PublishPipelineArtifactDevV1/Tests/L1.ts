import * as assert from "node:assert/strict";
import * as path from "node:path";
import { executeProcess, validateExecutable } from "pipeline-artifact-dev-common";

describe("PublishPipelineArtifactDevV1 local ArtifactTool L1", function () {
    this.timeout(15000);
    let executable: string;

    before(async function () {
        const supplied = process.env.PIPELINE_ARTIFACT_DEV_TOOL;
        if (!supplied) {
            this.skip();
            return;
        }
        executable = await validateExecutable(supplied);
    });

    it("recognizes publish metadata options before rejecting an invalid run ID without network access", async () => {
        const lines: string[] = [];
        const code = await executeProcess(executable, [
            "pipelineartifact", "publish", "--service", "https://dev.azure.com/test",
            "--patvar", "UNUSED_DEV_TOKEN", "--project", "project", "--pipeline-id", "0",
            "--path", path.dirname(executable), "--artifact-name", "drop", "--job-id", "job",
            "--properties-file", path.join(path.dirname(executable), "not-read.json"), "--domain-id", "1", "--hash-type", "Dedup1024K"
        ], process.env, new AbortController().signal, line => { lines.push(line); });
        assert.equal(code, 2);
        assert.match(lines.join("\n"), /pipeline-id must be between 1 and 2147483647/);
    });

    it("recognizes repeated download patterns before rejecting an invalid run ID", async () => {
        const lines: string[] = [];
        const code = await executeProcess(executable, [
            "pipelineartifact", "download", "--service", "https://dev.azure.com/test",
            "--patvar", "UNUSED_DEV_TOKEN", "--project", "project", "--pipeline-id", "0",
            "--path", path.dirname(executable), "--pattern", "drop/**/*.dll", "--pattern", "!drop/tests/**"
        ], process.env, new AbortController().signal, line => { lines.push(line); });
        assert.equal(code, 2);
        assert.match(lines.join("\n"), /pipeline-id must be between 1 and 2147483647/);
    });
});
