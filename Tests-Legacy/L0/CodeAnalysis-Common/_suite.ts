/// <reference path="../../definitions/mocha.d.ts"/>
/// <reference path="../../definitions/node.d.ts"/>
import assert = require('assert');

import mockHelper = require('../../lib/mockHelper');
import path = require('path');
import fs = require('fs');
import shell = require('shelljs');

let FileSystemInteractions = require('../../../Tasks/Common/codeanalysis-common/Common/FileSystemInteractions').FileSystemInteractions;


function createTempDir(): string {
    var testTempDir: string = path.join(__dirname, '_temp');

    if (!fs.existsSync(testTempDir)) {
        fs.mkdirSync(testTempDir);
    }

    return testTempDir;
}

function deleteFolderRecursive(path): void {
    if (fs.existsSync(path)) {
        fs.readdirSync(path).forEach(function (file, index) {
            var curPath = path + "/" + file;
            if (fs.lstatSync(curPath).isDirectory()) { // recurse
                deleteFolderRecursive(curPath);
            } else { // delete file
                fs.unlinkSync(curPath);
            }
        });
        fs.rmdirSync(path);
    }
};

describe('Code Analysis Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT) || 20000);

    before((done) => {
        done();
    });

    after(function () {
    });

    /* Standalone Code Analysis unit tests */

    it('Code Analysis common - createDirectory correctly creates new dir', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();

        if (!fs.existsSync(testStgDir)) {
            fs.mkdirSync(testStgDir);
        }

        var newFolder1 = path.join(testStgDir, 'fish');

        // Act
        FileSystemInteractions.createDirectory(newFolder1);

        // Assert
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder1}`);

        deleteFolderRecursive(testStgDir);
    });

    it('Code Analysis common - createDirectory correctly creates new dir and 1 directory in between', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();
        var newFolder1 = path.join(testStgDir, 'fish');

        if (!fs.existsSync(testStgDir)) {
            fs.mkdirSync(testStgDir);
        }
        if (!fs.existsSync(newFolder1)) {
            fs.mkdirSync(newFolder1);
        }

        var newFolder2 = path.join(testStgDir, 'fish', 'and');
        var newFolder3 = path.join(testStgDir, 'fish', 'and', 'chips');

        // Act
        FileSystemInteractions.createDirectory(newFolder3);

        // Assert
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder2}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder3}`);

        deleteFolderRecursive(testStgDir);
    });

    it('Code Analysis common - createDirectory correctly creates new dir and 2 directories in between', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();
        var newFolder1 = path.join(testStgDir, 'fish');

        if (!fs.existsSync(testStgDir)) {
            fs.mkdirSync(testStgDir);
        }
        if (!fs.existsSync(newFolder1)) {
            fs.mkdirSync(newFolder1);
        }

        var newFolder2 = path.join(testStgDir, 'fish', 'and');
        var newFolder3 = path.join(testStgDir, 'fish', 'and', 'chips');

        // Act
        FileSystemInteractions.createDirectory(newFolder3);

        // Assert
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder2}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder3}`);

        deleteFolderRecursive(testStgDir);
    });

    it('Code Analysis common - createDirectory correctly creates new dir and all directories in between', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();

        if (!fs.existsSync(testStgDir)) {
            fs.mkdirSync(testStgDir);
        }

        var newFolder1 = path.join(testStgDir, 'fish');
        var newFolder2 = path.join(testStgDir, 'fish', 'and');
        var newFolder3 = path.join(testStgDir, 'fish', 'and', 'chips');

        // Act
        FileSystemInteractions.createDirectory(newFolder3);

        // Assert
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder1}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder2}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder3}`);

        deleteFolderRecursive(testStgDir);
    });

    it('Code Analysis common - createDirectory correctly creates new dir and all directories in between (repeating dir names)', () => {
        // Arrange
        var testStgDir: string = path.join(__dirname, '_temp');
        createTempDir();

        if (!fs.existsSync(testStgDir)) {
            fs.mkdirSync(testStgDir);
        }

        var newFolder1 = path.join(testStgDir, 'fish');
        var newFolder2 = path.join(testStgDir, 'fish', 'and');
        var newFolder3 = path.join(testStgDir, 'fish', 'and', 'fish');

        // Act
        FileSystemInteractions.createDirectory(newFolder3);

        // Assert
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder1}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder2}`);
        assert(fs.existsSync(newFolder1), `Expected folder to have been created: ${newFolder3}`);

        deleteFolderRecursive(testStgDir);
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory fails with illegal chars', function (done) {
        this.timeout(1000);

        var testPath = path.join(createTempDir(), 'mkdir\0');
        var worked: boolean = false;
        try {
            FileSystemInteractions.createDirectory(testPath);
            worked = true;
        }
        catch (err) {
            // asserting failure
            assert(!shell.test('-d', testPath), 'directory should not be created');
        }

        assert(!worked, 'mkdirP with illegal chars should have not have worked');

        done();
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory fails with null path', function (done) {
        this.timeout(1000);

        var worked: boolean = false;
        try {
            FileSystemInteractions.createDirectory(null);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'mkdirP with null should have not have worked');

        done();
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory fails with empty path', function (done) {
        this.timeout(1000);

        var worked: boolean = false;
        try {
            FileSystemInteractions.createDirectory('');
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'mkdirP with empty string should have not have worked');

        done();
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory fails with conflicting file path', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(createTempDir(), 'mkdirP_conflicting_file_path');
        shell.mkdir('-p', createTempDir());
        fs.writeFileSync(testPath, '');
        let worked: boolean = false;
        try {
            FileSystemInteractions.createDirectory(testPath);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'mkdirP with conflicting file path should not have worked');

        done();
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory fails with conflicting parent file path', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(createTempDir(), 'mkdirP_conflicting_parent_file_path', 'dir');
        shell.mkdir('-p', createTempDir());
        fs.writeFileSync(path.dirname(testPath), '');
        let worked: boolean = false;
        try {
            FileSystemInteractions.createDirectory(testPath);
            worked = true;
        }
        catch (err) { }

        assert(!worked, 'mkdirP with conflicting file path should not have worked');

        done();
    });

    // Copied from: https://github.com/Microsoft/vsts-task-lib/blob/master/node/test/dirtests.ts
    it('Code Analysis common - createDirectory no-ops if mkdirP directory exists', (done: MochaDone) => {
        this.timeout(1000);

        let testPath = path.join(createTempDir(), 'mkdirP_dir_exists');
        shell.mkdir('-p', createTempDir());
        fs.mkdirSync(testPath);

        FileSystemInteractions.createDirectory(testPath); // should not throw

        done();
    });
 });