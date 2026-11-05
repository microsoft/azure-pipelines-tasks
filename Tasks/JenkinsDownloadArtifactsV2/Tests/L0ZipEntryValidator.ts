import assert = require('assert');
import path = require('path');

import { findEntryOutsideRoot } from '../ZipEntryValidator';

describe('ZipEntryValidator', function () {
    const root = path.resolve('jenkinsArtifacts');

    it('accepts entries inside the target directory', () => {
        assert.strictEqual(findEntryOutsideRoot(root, ['archive/a/b.txt', 'archive/', 'archive/x/../y.txt']), undefined);
    });

    it('rejects parent traversal entries', () => {
        assert.strictEqual(findEntryOutsideRoot(root, ['archive/a.txt', '../x']), '../x');
    });

    it('rejects sibling-prefix entries', () => {
        const entry = 'archive/../../jenkinsArtifacts-evil/payload';
        assert.strictEqual(findEntryOutsideRoot(root, [entry]), entry);
    });

    it('rejects backslash traversal entries', () => {
        const entry = 'archive\\..\\..\\jenkinsArtifacts-evil\\payload';
        assert.strictEqual(findEntryOutsideRoot(root, [entry]), entry);
    });

    it('rejects absolute entries', () => {
        assert.strictEqual(findEntryOutsideRoot(root, ['/etc/passwd']), '/etc/passwd');
        assert.strictEqual(findEntryOutsideRoot(root, ['C:\\temp\\x']), 'C:\\temp\\x');
    });
});
