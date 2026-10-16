import assert = require("assert");

import {
    isAtLeastVersion,
    isPercentDecodingDisabled,
    minimumAgentVersionForSafeOutputVariables
} from "../operations/agentCompatibility";

// Unit tests for the agent capability checks that decide whether deployment outputs can be
// published with the safe logging command format. The safe format relies on the agent decoding
// the %AZP25 escape sequence, which older agents do not do.
export function runAgentCompatibilityTests() {

    it('Should require the agent version that decodes percent escaping by default', () => {
        // 2.182.0 introduced the sequence but left decoding opt-in; 2.184.0 made it the default.
        assert.strictEqual(minimumAgentVersionForSafeOutputVariables, '2.184.0');
    });

    it('Should accept agents at or above the minimum version', () => {
        assert.strictEqual(isAtLeastVersion('2.184.0', '2.184.0'), true, 'an exact match is supported');
        assert.strictEqual(isAtLeastVersion('2.184.1', '2.184.0'), true);
        assert.strictEqual(isAtLeastVersion('2.185.0', '2.184.0'), true);
        assert.strictEqual(isAtLeastVersion('3.245.1', '2.184.0'), true);
        assert.strictEqual(isAtLeastVersion('10.0.0', '2.184.0'), true, 'components compare numerically, not as text');
    });

    it('Should reject agents below the minimum version', () => {
        assert.strictEqual(isAtLeastVersion('2.183.1', '2.184.0'), false);
        assert.strictEqual(isAtLeastVersion('2.182.0', '2.184.0'), false, 'the sequence is known but decoding is off by default');
        assert.strictEqual(isAtLeastVersion('2.181.2', '2.184.0'), false);
        assert.strictEqual(isAtLeastVersion('2.9.0', '2.184.0'), false, 'a shorter minor component is still lower');
    });

    it('Should treat an unusable version as unsupported', () => {
        assert.strictEqual(isAtLeastVersion(null, '2.184.0'), false);
        assert.strictEqual(isAtLeastVersion(undefined, '2.184.0'), false);
        assert.strictEqual(isAtLeastVersion('', '2.184.0'), false);
        assert.strictEqual(isAtLeastVersion('not-a-version', '2.184.0'), false);
        assert.strictEqual(isAtLeastVersion('2.x.0', '2.184.0'), false);
    });

    it('Should read a version that omits the patch component', () => {
        assert.strictEqual(isAtLeastVersion('2.184', '2.184.0'), true);
        assert.strictEqual(isAtLeastVersion('2.183', '2.184.0'), false);
    });

    it('Should compare decorated agent versions by their numeric core', () => {
        assert.strictEqual(isAtLeastVersion('2.184.0-preview.1', '2.184.0'), true);
        assert.strictEqual(isAtLeastVersion('2.184.0+build.7', '2.184.0'), true);
        assert.strictEqual(isAtLeastVersion('2.183.9-preview.1', '2.184.0'), false);
    });

    describe('Percent decoding knob', () => {
        const originalVariable = process.env["DECODE_PERCENTS"];

        afterEach(() => {
            if (originalVariable === undefined) {
                delete process.env["DECODE_PERCENTS"];
            } else {
                process.env["DECODE_PERCENTS"] = originalVariable;
            }
        });

        it('Should treat an unset knob as decoding enabled', () => {
            delete process.env["DECODE_PERCENTS"];
            assert.strictEqual(isPercentDecodingDisabled(), false);
        });

        it('Should treat the values the agent accepts as decoding enabled', () => {
            for (const value of ['true', 'TRUE', '1', '$true', ' true ']) {
                process.env["DECODE_PERCENTS"] = value;
                assert.strictEqual(isPercentDecodingDisabled(), false, `'${value}' should enable decoding`);
            }
        });

        it('Should treat an explicit false as decoding disabled', () => {
            for (const value of ['false', 'FALSE', '0', '$false']) {
                process.env["DECODE_PERCENTS"] = value;
                assert.strictEqual(isPercentDecodingDisabled(), true, `'${value}' should disable decoding`);
            }
        });

        // The agent parses this knob with StringUtil.ConvertToBoolean, which falls back to false
        // for anything it does not recognise. A value like 'yes' therefore disables decoding.
        it('Should treat an unrecognised value as decoding disabled', () => {
            for (const value of ['yes', 'on', 'enabled']) {
                process.env["DECODE_PERCENTS"] = value;
                assert.strictEqual(isPercentDecodingDisabled(), true, `'${value}' is not recognised by the agent`);
            }
        });

        it('Should ignore an empty knob and use the default', () => {
            process.env["DECODE_PERCENTS"] = "   ";
            assert.strictEqual(isPercentDecodingDisabled(), false);
        });
    });
}
