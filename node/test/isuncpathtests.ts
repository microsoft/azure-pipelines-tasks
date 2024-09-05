// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import * as im from '../_build/internal';
import testutil = require('./testutil');

describe('Is UNC-path Tests', function () {

    before(function (done) {
        try {
            testutil.initialize();
        } catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function () {
    });

    it('checks if path is unc path', (done) => {
        this.timeout(1000);

        const paths = [
            { inputPath: '\\server\\path\\to\\file', isUNC: false },
            { inputPath: '\\\\server\\path\\to\\file', isUNC: true },
            { inputPath: '\\\\\\server\\path\\to\\file', isUNC: false },
            { inputPath: '!@#$%^&*()_+', isUNC: false },
            { inputPath: '\\\\\\\\\\\\', isUNC: false },
            { inputPath: '1q2w3e4r5t6y', isUNC: false },
            { inputPath: '', isUNC: false }
        ];

        for (let path of paths) {
            assert.deepEqual(im._isUncPath(path.inputPath), path.isUNC);
        }

        done();
    });
});
