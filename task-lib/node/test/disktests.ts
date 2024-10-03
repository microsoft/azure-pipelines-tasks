// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert = require('assert');
import path = require('path');
import fs = require('fs');
import * as tl from '../_build/task';
import * as trm from '../_build/toolrunner';

import testutil = require('./testutil');

describe('Disk Operation Tests', function () {

    before(function (done) {
        try {
            testutil.initialize();
        }
        catch (err) {
            assert.fail('Failed to load task lib: ' + err.message);
        }
        done();
    });

    after(function () {

    });

    it('check exist functionality for existing file', function (done) {
        this.timeout(1000);

        tl.mkdirP(testutil.getTestTemp());
        var fileName = path.join(testutil.getTestTemp(), "test.txt");
        fs.writeFileSync(fileName, "");

        assert(tl.exist(fileName), "file should exists"); //check existance of file
        fs.unlinkSync(fileName);
        done();
    });

    it('check exist functionality for non existing file', function (done) {
        this.timeout(1000);

        var fileName = path.join(testutil.getTestTemp(), "test.txt");
        assert(!tl.exist(fileName), "file shouldn't be existing");
        done();
    });

    it('write file functionality for valid file path', function (done) {
        this.timeout(1000);

        var fileName = path.join(testutil.getTestTemp(), "writeFileTest.txt");
        tl.writeFile(fileName, "testing writefile method");
        assert(tl.exist(fileName), "writeFile should create the file");
        done();
    })

    it('write file functionality with options', function (done) {
        var fileName = path.join(testutil.getTestTemp(), "writeFileTest.txt");
        tl.writeFile(fileName, "testing writeFile() with encoding", 'utf-8');
        assert(fs.readFileSync(fileName, 'utf-8') === "testing writeFile() with encoding", "writeFile should create file with correct options");
        done();
    })
});
