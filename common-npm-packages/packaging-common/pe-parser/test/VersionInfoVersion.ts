import * as assert from "assert";

import VersionInfoVersion from "../VersionInfoVersion";

describe("VersionInfoVersion", function() {
    it("should parse versions supplied as two DWORDs correctly", function() {
        let version = VersionInfoVersion.fromDWords(0x00010002, 0x00030004);
        assert.strictEqual(version.a, 1);
        assert.strictEqual(version.b, 2);
        assert.strictEqual(version.c, 3);
        assert.strictEqual(version.d, 4);
    });

    it("should parse versions supplied as two DWORDs with large values correctly", function() {
        let version = VersionInfoVersion.fromDWords(0xFFF1FFF2, 0xFFF3FFF4);
        assert.strictEqual(version.a, 0xFFF1);
        assert.strictEqual(version.b, 0xFFF2);
        assert.strictEqual(version.c, 0xFFF3);
        assert.strictEqual(version.d, 0xFFF4);
    });

    it("should compare versions correctly (less than)", function() {
        let a = new VersionInfoVersion(1, 2, 3, 4);
        let b = new VersionInfoVersion(2, 3, 4, 5);

        let comparison = VersionInfoVersion.compare(a, b);

        assert.strictEqual(comparison, -1, `${a} < ${b}`);
    });

    it("should compare versions correctly (equals)", function() {
        let a = new VersionInfoVersion(1, 2, 3, 4);
        let b = new VersionInfoVersion(1, 2, 3, 4);

        let comparison = VersionInfoVersion.compare(a, b);

        assert.strictEqual(comparison, 0, `${a} = ${b}`);
    });

    it("should compare versions correctly (greater than)", function() {
        let a = new VersionInfoVersion(2, 3, 4, 5);
        let b = new VersionInfoVersion(1, 2, 3, 4);

        let comparison = VersionInfoVersion.compare(a, b);

        assert.strictEqual(comparison, 1, `${a} > ${b}`);
    });
});
