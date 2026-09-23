import assert = require('assert');
import stream = require('stream');
import { createRemoteOutputStream } from '../sshhelper';
import * as utils from '../utils';

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

        it('Should filter VSO commands from chunked remote output', async function () {
            const chunks: Buffer[] = [];
            const destination = new stream.Writable({
                write: (chunk: Buffer, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void => {
                    chunks.push(Buffer.from(chunk));
                    callback();
                }
            });
            const output = createRemoteOutputStream(destination);
            const ended = new Promise<void>((resolve, reject) => {
                output.on('end', resolve);
                output.on('error', reject);
                destination.on('error', reject);
            });

            output.write('ordinary remote output\n##vs');
            output.end('o[task.setvariable variable=unsafe]value\n');
            await ended;

            assert.strictEqual(
                Buffer.concat(chunks).toString('utf8'),
                'ordinary remote output\n##_vso[task.setvariable variable=unsafe]value\n'
            );
        });
    });
}