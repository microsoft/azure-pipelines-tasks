import assert = require('assert');
import path = require('path');
import tl = require('azure-pipelines-task-lib/task');

tl.setResourcePath(path.join(__dirname, '..', 'task.json'));

import { resolveRemoteFilePath } from '../ftputils';

describe('FtpUploadV2 resolveRemoteFilePath Suite', function () {
    this.timeout(parseInt(process.env.TASK_TEST_TIMEOUT!) || 20000);

    it('Should accept a relative path that stays inside the remote directory', function () {
        const remoteFile: string = resolveRemoteFilePath('/upload/123', 'folder1/file2.txt');
        assert.strictEqual(remoteFile, '/upload/123/folder1/file2.txt');
    });

    it('Should reject a relative path that escapes the remote directory using forward slashes', function () {
        assert.throws(
            () => resolveRemoteFilePath('/upload/123', '../../etc/passwd'),
            (err: Error) => {
                assert.strictEqual(err.message, "File name '../../etc/passwd' would be uploaded outside the remote directory '/upload/123'.");
                return true;
            }
        );
    });

    it('Should accept a relative path when the remote directory is the current directory ("./")', function () {
        const remoteFile: string = resolveRemoteFilePath('./', 'file.txt');
        assert.strictEqual(remoteFile, 'file.txt');
    });

    it('Should accept a nested relative path when the remote directory is the current directory ("./")', function () {
        const remoteFile: string = resolveRemoteFilePath('./', 'folder1/file2.txt');
        assert.strictEqual(remoteFile, 'folder1/file2.txt');
    });

    it('Should still reject a traversal attempt when the remote directory is the current directory ("./")', function () {
        assert.throws(
            () => resolveRemoteFilePath('./', '../evil.txt'),
            (err: Error) => {
                assert.strictEqual(err.message, "File name '../evil.txt' would be uploaded outside the remote directory './'.");
                return true;
            }
        );
    });

    it('Should convert Windows path separators before validating so a preservePaths-style relative path cannot escape the remote directory', function () {
        // preservePaths computes the relative path by slicing a Windows-style absolute path, so on a
        // Windows agent it can contain real backslash separators. Simulate a Windows agent so this
        // check is exercised regardless of the OS this test actually runs on.
        const realPlatform: PropertyDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
        Object.defineProperty(process, 'platform', { value: 'win32' });
        try {
            const remoteFile: string = resolveRemoteFilePath('.', '\\sub\\file.txt');
            assert.strictEqual(remoteFile, 'sub/file.txt');
        } finally {
            Object.defineProperty(process, 'platform', realPlatform);
        }
    });

    it('Should reject a Windows-separator relative path that would escape the remote directory', function () {
        const realPlatform: PropertyDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
        Object.defineProperty(process, 'platform', { value: 'win32' });
        try {
            assert.throws(
                () => resolveRemoteFilePath('.', '..\\..\\etc\\passwd'),
                (err: Error) => {
                    assert.strictEqual(err.message, "File name '..\\..\\etc\\passwd' would be uploaded outside the remote directory '.'.");
                    return true;
                }
            );
        } finally {
            Object.defineProperty(process, 'platform', realPlatform);
        }
    });

    it('Should reject a file name with backslashes that would resolve outside the remote directory on a non-Windows agent', function () {
        // basic-ftp always talks to the remote over a POSIX-style path, so backslashes are only ever
        // genuine separators when the agent itself is Windows (where they cannot appear in a real file
        // name). Simulate a non-Windows agent so this check is exercised regardless of the OS this test
        // actually runs on.
        const realPlatform: PropertyDescriptor = Object.getOwnPropertyDescriptor(process, 'platform')!;
        Object.defineProperty(process, 'platform', { value: 'linux' });
        try {
            assert.throws(
                () => resolveRemoteFilePath('/upload/123', '..\\..\\protected\\victim.txt'),
                (err: Error) => {
                    assert.strictEqual(err.message, "File name '..\\..\\protected\\victim.txt' contains a backslash, which is not supported when uploading from this agent's operating system.");
                    return true;
                }
            );
        } finally {
            Object.defineProperty(process, 'platform', realPlatform);
        }
    });
});
