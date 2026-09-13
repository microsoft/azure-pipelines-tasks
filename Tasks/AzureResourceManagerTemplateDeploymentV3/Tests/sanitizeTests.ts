import assert = require("assert");

import { sanitizeForLoggingCommand } from "../operations/sanitize";

// Unit tests for sanitizeForLoggingCommand - prevents ##vso[ logging-command injection
// through ARM deployment output names and values that reach the build log.
export function runSanitizeTests() {

    it('Should leave ordinary output names unchanged', () => {
        assert.strictEqual(sanitizeForLoggingCommand('armOut.storageName'), 'armOut.storageName');
        assert.strictEqual(sanitizeForLoggingCommand('armOut.storage_Account-1'), 'armOut.storage_Account-1');
    });

    it('Should neutralize a newline-delimited injection payload', () => {
        const malicious = 'armOut.storageName\n##vso[task.setvariable variable=INJECTED]pwned';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert.ok(!sanitized.includes('##vso['), 'marker must not survive');
        assert.ok(!/[\r\n]/.test(sanitized), 'must not span more than one line');
    });

    // The agent locates the marker with an index-of match, so a payload needs no newline
    // at all - it only has to appear somewhere on the line.
    it('Should neutralize an injection payload that contains no newline', () => {
        const malicious = 'armOut.safe##vso[task.setvariable variable=INJECTED]pwned';
        const sanitized = sanitizeForLoggingCommand(malicious);
        assert.ok(!sanitized.includes('##vso['), 'marker must not survive without a newline');
    });

    it('Should neutralize a prependpath payload', () => {
        const sanitized = sanitizeForLoggingCommand('armOut.x##vso[task.prependpath]C:\\EVIL');
        assert.ok(!sanitized.includes('##vso['), 'prependpath marker must not survive');
    });

    it('Should neutralize a setendpoint payload regardless of casing', () => {
        const sanitized = sanitizeForLoggingCommand('armOut.x ##VSO[task.setendpoint id=SystemVssConnection;field=url]http://evil');
        assert.ok(!/##vso\[/i.test(sanitized), 'upper-case marker must not survive');
    });

    // A single pass over "##vso[" would rewrite the inner match and leave a live marker
    // behind, so the pattern matches a run of leading hashes instead.
    it('Should fully neutralize a marker padded with extra hashes', () => {
        const sanitized = sanitizeForLoggingCommand('armOut.x####vso[task.prependpath]/tmp/evil');
        assert.ok(!sanitized.includes('##vso['), 'residual marker must not remain after replacement');
    });

    it('Should neutralize formatting commands', () => {
        const sanitized = sanitizeForLoggingCommand('armOut.x##[section]Injected section');
        assert.ok(!sanitized.includes('##['), 'formatting marker must not survive');
    });

    // CR/LF runs collapse to a space rather than to nothing, so the two halves cannot be
    // rejoined into a live marker.
    it('Should not rejoin a marker that is split by a newline', () => {
        const sanitized = sanitizeForLoggingCommand('armOut.x##\nvso[task.setvariable variable=INJECTED]pwned');
        assert.ok(!sanitized.includes('##vso['), 'split marker must not be rejoined');
    });

    it('Should collapse CRLF sequences', () => {
        const sanitized = sanitizeForLoggingCommand('armOut.x\r\n##vso[task.complete result=Failed]');
        assert.ok(!sanitized.includes('##vso['), 'marker must not survive');
        assert.ok(!/[\r\n]/.test(sanitized), 'CRLF must be collapsed');
    });

    it('Should neutralize every marker when several are present', () => {
        const sanitized = sanitizeForLoggingCommand('##vso[task.setvariable variable=A]x ##vso[task.setvariable variable=B]y');
        assert.ok(!sanitized.includes('##vso['), 'all markers must be neutralized');
    });

    // Nested object keys reach the same log line through the recursive walk over outputs.
    it('Should neutralize a payload carried by a nested output key', () => {
        const sanitized = sanitizeForLoggingCommand('armOut.myObj.x##vso[task.prependpath]/tmp/evil');
        assert.ok(!sanitized.includes('##vso['), 'nested key payload must be neutralized');
    });

    it('Should keep sanitized text readable', () => {
        const sanitized = sanitizeForLoggingCommand('armOut.x##vso[task.prependpath]/tmp/evil');
        assert.ok(sanitized.includes('#vso[task.prependpath]'), 'text should remain legible in the log');
    });

    it('Should pass through empty and nullish values unchanged', () => {
        assert.strictEqual(sanitizeForLoggingCommand(null), null);
        assert.strictEqual(sanitizeForLoggingCommand(undefined), undefined);
        assert.strictEqual(sanitizeForLoggingCommand(''), '');
    });
}
