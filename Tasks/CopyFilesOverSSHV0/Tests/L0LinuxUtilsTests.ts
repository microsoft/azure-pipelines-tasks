import assert = require('assert');
import * as utils from '../utils';

export function run() {
    context('Utils tests: ', function () {
        const sourceFolder = './example';
        const targetFolder = './example';

        const filesToCopy = [
            './example/file1.txt',
            './example/folder1/file2.txt',
            './example/folder1/folder2/file3.txt'
        ];

        it('Should get the correct file paths from prepareFiles when flattendFolder is false', function (done: MochaDone) {
            const preparedFilesNonFlattened = utils.prepareFiles(filesToCopy, sourceFolder, targetFolder, false);

            const expected = [
                './example/file1.txt',
                './example/folder1/file2.txt',
                './example/folder1/folder2/file3.txt'
            ];

            preparedFilesNonFlattened.forEach((file, index) => {
                assert(file[0] === filesToCopy[index], `Source file path should be the same as the original file path: ${file[0]} !== ${filesToCopy[index]}`);
                assert(file[1] === expected[index], `Prepared file path should be the same as the original file path since the flattenFolder argument is false: ${file[1]} !== ${expected[index]}`);
            });

            done();
        });

        it('Should get the correct file paths from prepareFiles when flattendFolder is true', function (done: MochaDone) {
            const preparedFilesFlattened = utils.prepareFiles(filesToCopy, sourceFolder, targetFolder, true);

            const expected = [
                './example/file1.txt',
                './example/file2.txt',
                './example/file3.txt'
            ];

            preparedFilesFlattened.forEach((file, index) => {
                assert(file[0] === filesToCopy[index], `Source file path should be the same as the original file path: ${file[0]} !== ${filesToCopy[index]}`);
                assert(file[1] === expected[index], `Prepared file path should be the converted as flattened to a root since the flattendFolder argument is true: ${file[1]} !== ${expected[index]}`);
            });

            done();
        });
    });
}