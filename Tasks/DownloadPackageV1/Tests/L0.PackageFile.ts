import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// PackageFile constructor uses tl.getVariable('Agent.TempDirectory').
// We stub the task-lib module to avoid any real task-lib side effects.
import * as tl from 'azure-pipelines-task-lib/task';
import { PackageFile } from '../packagefile';

describe('DownloadPackageV1 L0 Suite - PackageFile Unit Behavior', function () {
    const originalGetVariable = tl.getVariable;

    beforeEach(() => {
        // Stub getVariable to return a known temp dir without touching the filesystem
        (tl as any).getVariable = (name: string) => {
            if (name === 'Agent.TempDirectory') return '/mock/agent/temp';
            return undefined;
        };
    });

    afterEach(() => {
        (tl as any).getVariable = originalGetVariable;
    });

    describe('Constructor path resolution', function () {
        it('places file in temp directory when extract is true', () => {
            const pf = new PackageFile(true, '/dest/output', 'mypackage.nupkg');

            assert.strictEqual(pf.downloadPath, path.resolve('/mock/agent/temp', 'mypackage.nupkg'));
        });

        it('places file in destination directory when extract is false', () => {
            const pf = new PackageFile(false, '/dest/output', 'mypackage.nupkg');

            assert.strictEqual(pf.downloadPath, path.resolve('/dest/output', 'mypackage.nupkg'));
        });

        it('allows nested relative package file paths', () => {
            const pf = new PackageFile(false, '/dest/output', 'lib/mypackage.jar');

            assert.strictEqual(pf.downloadPath, path.resolve('/dest/output', 'lib/mypackage.jar'));
        });

        it('handles .tgz extension the same way', () => {
            const pf = new PackageFile(true, '/dest', 'pkg.tgz');

            assert.strictEqual(pf.downloadPath, path.resolve('/mock/agent/temp', 'pkg.tgz'));
        });

        it('handles .crate extension the same way', () => {
            const pf = new PackageFile(true, '/dest', 'pkg.crate');

            assert.strictEqual(pf.downloadPath, path.resolve('/mock/agent/temp', 'pkg.crate'));
        });

        for (const filename of [
            '../outside.txt',
            'nested/../../outside.txt',
            '/etc/cron.d/package-task',
            'C:\\Windows\\Temp\\package-task',
            '\\\\server\\share\\package-task'
        ]) {
            it(`rejects unsafe package file path ${filename}`, () => {
                assert.throws(() => new PackageFile(false, '/dest/output', filename));
            });
        }
    });

    describe('process() behavior', function () {
        it('returns immediately when extract is false (no-op)', async () => {
            const pf = new PackageFile(false, '/dest', 'pkg.nupkg');

            // Should resolve without error — no extraction attempted
            await pf.process();
        });
    });

    describe('Link validation', function () {
        let testRoot: string;
        let destination: string;
        let outside: string;

        beforeEach(() => {
            testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'download-package-'));
            destination = path.join(testRoot, 'destination');
            outside = path.join(testRoot, 'outside');
            fs.mkdirSync(destination);
            fs.mkdirSync(outside);
        });

        afterEach(() => {
            fs.rmSync(testRoot, { recursive: true, force: true });
        });

        function createDirectoryLink(target: string, linkPath: string): void {
            fs.symlinkSync(target, linkPath, process.platform === 'win32' ? 'junction' : 'dir');
        }

        it('allows the selected destination root to be a link', async () => {
            const linkedDestination = path.join(testRoot, 'linked-destination');
            createDirectoryLink(destination, linkedDestination);
            fs.mkdirSync(path.join(destination, 'lib'));

            const pf = new PackageFile(false, linkedDestination, 'lib/package.jar');

            await assert.doesNotReject(() => pf.writeContent('package content'));
        });

        it('rejects a linked parent beneath the destination', () => {
            createDirectoryLink(outside, path.join(destination, 'lib'));
            const pf = new PackageFile(false, destination, 'lib/package.jar');

            assert.throws(() => pf.removeExisting());
        });

        it('rejects a linked final target', () => {
            createDirectoryLink(outside, path.join(destination, 'package.jar'));
            const pf = new PackageFile(false, destination, 'package.jar');

            assert.throws(() => pf.createWriteStream());
        });

        it('revalidates the temporary archive before extraction', async () => {
            (tl as any).getVariable = (name: string) => {
                if (name === 'Agent.TempDirectory') return destination;
                return undefined;
            };
            createDirectoryLink(outside, path.join(destination, 'package.nupkg'));
            const pf = new PackageFile(true, '/dest/output', 'package.nupkg');

            await assert.rejects(() => pf.process());
        });
    });
});
