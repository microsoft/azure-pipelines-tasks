import * as assert from 'assert';
import { isNuGetVersionSupported } from '../nugetVersion';

describe('NuGetV0 L0 Suite - Version Gate Unit Behavior', function () {
    it('rejects major versions below 3', () => {
        assert.strictEqual(isNuGetVersionSupported({ a: 2, b: 9 }), false);
    });

    it('rejects 3.4.x boundary', () => {
        assert.strictEqual(isNuGetVersionSupported({ a: 3, b: 4 }), false);
    });

    it('accepts exact minimum version 3.5.0 boundary', () => {
        assert.strictEqual(isNuGetVersionSupported({ a: 3, b: 5 }), true);
    });

    it('accepts versions above minimum threshold', () => {
        assert.strictEqual(isNuGetVersionSupported({ a: 4, b: 0 }), true);
        assert.strictEqual(isNuGetVersionSupported({ a: 5, b: 11 }), true);
    });
});
