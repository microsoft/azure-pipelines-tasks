import assert = require('assert');
import * as fs from 'fs';
import * as path from 'path';
import { removeCredentialFile, writeCredentialFile } from '../src/lib/credentialFile';

export function runCredentialFileTests() {
    describe('Credential file', function () {
        let agentTemp: string;

        beforeEach(function () {
            agentTemp = fs.mkdtempSync(path.join(__dirname, '.credential-file-'));
        });

        afterEach(function () {
            fs.rmSync(agentTemp, { recursive: true, force: true });
        });

        it('writes each credential to a unique directory without touching a pre-existing root file', function () {
            const rootCertificate = path.join(agentTemp, 'spnCert.pem');
            fs.writeFileSync(rootCertificate, 'pre-existing');

            const first = writeCredentialFile(agentTemp, 'spnCert.pem', 'first');
            const second = writeCredentialFile(agentTemp, 'spnCert.pem', 'second');

            assert.notStrictEqual(first.directoryPath, second.directoryPath);
            for (const credential of [first, second]) {
                assert.strictEqual(path.dirname(credential.directoryPath), agentTemp);
                assert(path.basename(credential.directoryPath).startsWith('.notation-credentials-'));
                assert.strictEqual(credential.filePath, path.join(credential.directoryPath, 'spnCert.pem'));
            }
            assert.strictEqual(fs.readFileSync(first.filePath, 'utf8'), 'first');
            assert.strictEqual(fs.readFileSync(second.filePath, 'utf8'), 'second');

            removeCredentialFile(first);
            assert(!fs.existsSync(first.directoryPath), 'credential directory should be removed');
            assert(fs.existsSync(second.filePath), 'removing one credential must not remove another');
            removeCredentialFile(second);
            assert.strictEqual(fs.readFileSync(rootCertificate, 'utf8'), 'pre-existing');
        });

        it('uses directory 0700 and file 0600 permissions on Unix', function () {
            if (process.platform === 'win32') {
                this.skip();
            }

            const credential = writeCredentialFile(agentTemp, 'oidcToken', 'token');
            assert.strictEqual(fs.statSync(credential.directoryPath).mode & 0o777, 0o700);
            assert.strictEqual(fs.statSync(credential.filePath).mode & 0o777, 0o600);
            removeCredentialFile(credential);
        });

        it('ignores a missing credential file', function () {
            removeCredentialFile(undefined);
        });
    });
}
