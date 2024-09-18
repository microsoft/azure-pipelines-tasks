import assert = require('assert');
import * as utils from '../utils';

export function run() {
    context('Utils tests: ', function () {
        const filesToCopy = [
            'C:/example/file1.txt',
            'C:/example/folder1/file2.txt',
            'C:/example/folder1/folder2/file3.txt'
        ];

        const sourceFolder = 'C:/example';
        const targetFolder = 'C:/example';

        it('Should recognize UNC paths', function (done: MochaDone) {
            const paths: string[] = [
                '\\\\host\\one\\two',
                '\\\\host\\one\\two\\',
                '\\\\host\\one\\two/file',
                '\\\\host/one/two/file'
            ];
            for (const path of paths) {
                assert(utils.pathIsUNC(path), `Should be recognized as UNC path: ${path}`);
            }
            done();
        });

        it('Should not recognize strings as UNC paths', function (done: MochaDone) {
            const paths: string[] = [
                '//host\\one\\two',
                '//host\\one\\two\\',
                '//host\\one\\two/file',
                '//host/one/two/file',
                '\\host\\one\\two',
            ];
            for (const path of paths) {
                assert(!utils.pathIsUNC(path), `Should not be recognized as UNC path: ${path}`);
            }
            done();
        });

        it('Should get the correct file paths from prepareFiles when flattendFolder is false', function (done: MochaDone) {
            const preparedFilesNonFlattened = utils.prepareFiles(filesToCopy, sourceFolder, targetFolder, false);

            const expected = [
                'C:/example/file1.txt',
                'C:/example/folder1/file2.txt',
                'C:/example/folder1/folder2/file3.txt'
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
                'C:/example/file1.txt',
                'C:/example/file2.txt',
                'C:/example/file3.txt'
            ];

            preparedFilesFlattened.forEach((file, index) => {
                assert(file[0] === filesToCopy[index], `Source file path should be the same as the original file path: ${file[0]} !== ${filesToCopy[index]}`);
                assert(file[1] === expected[index], `Prepared file path should be the converted as flattened to a root since the flattendFolder argument is true: ${file[1]} !== ${expected[index]}`);
            });

            done();
        });
    });
}