import * as assert from 'assert';
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

        it('handles .tgz extension the same way', () => {
            const pf = new PackageFile(true, '/dest', 'pkg.tgz');

            assert.strictEqual(pf.downloadPath, path.resolve('/mock/agent/temp', 'pkg.tgz'));
        });

        it('handles .crate extension the same way', () => {
            const pf = new PackageFile(true, '/dest', 'pkg.crate');

            assert.strictEqual(pf.downloadPath, path.resolve('/mock/agent/temp', 'pkg.crate'));
        });
    });

    describe('process() behavior', function () {
        it('returns immediately when extract is false (no-op)', async () => {
            const pf = new PackageFile(false, '/dest', 'pkg.nupkg');

            // Should resolve without error — no extraction attempted
            await pf.process();
        });
    });
});
