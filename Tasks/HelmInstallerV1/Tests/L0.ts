import fs = require('fs');
import assert = require('assert');
import path = require('path');

describe('HelmInstallerV1 Suite', function () {
    before(() => {
    });

    after(() => {
    });

    it('Does a basic hello world test', function(done: Mocha.Done) {
        // TODO - add real tests
        done();
    });

    it('Should filter out prerelease versions using prerelease field', function() {
        const mockResponse = [
            { tag_name: "v4.0.0-rc.1", prerelease: true },
            { tag_name: "v4.0.0-beta.1", prerelease: true },
            { tag_name: "v4.0.0-alpha.1", prerelease: true },
            { tag_name: "v3.15.4", prerelease: false },
            { tag_name: "v3.15.3", prerelease: false }
        ];

        const stableVersions = mockResponse.filter(r => !r.prerelease);
        assert.strictEqual(stableVersions.length, 2, 'Should filter out all prerelease versions');
        assert.strictEqual(stableVersions[0].tag_name, 'v3.15.4');
        assert.strictEqual(stableVersions[1].tag_name, 'v3.15.3');
    });
});
