import assert = require('assert');
import * as  utils from '../utils';

export function run() {
    context('Utils tests: ', function () {
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
    });
}