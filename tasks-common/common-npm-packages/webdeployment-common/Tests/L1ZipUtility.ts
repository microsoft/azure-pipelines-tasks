import * as path from 'path';
import assert = require('assert');
import { checkIfFilesExistsInZip } from "../ziputility";

export function runL1ZipUtilityTests(this: Mocha.Suite): void {

    it("Should skip ZIP entries validation", async () => {
        const archive = path.join(__dirname, '..', '..', 'Tests', 'L1ZipUtility', 'potentially_malicious.zip');

        const exists = await checkIfFilesExistsInZip(archive, ['index.html']);

        assert.strictEqual(exists, true);
    });

}