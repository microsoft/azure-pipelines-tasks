import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// PackageFile constructor uses tl.getVariable('Agent.TempDirectory').
// We stub the task-lib module to avoid any real task-lib side effects.
import * as tl from 'azure-pipelines-task-lib/task';
import { PackageFile } from '../packagefile';

interface ZipEntryForTest {
    name: string;
    content: string;
    mode?: number;
}

function createZip(entries: ZipEntryForTest[]): Buffer {
    const localEntries: Buffer[] = [];
    const centralEntries: Buffer[] = [];
    let localEntriesSize = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.name);
        const content = Buffer.from(entry.content);
        const checksum = crc32(content);
        const localEntry = Buffer.alloc(30 + name.length + content.length);
        localEntry.writeUInt32LE(0x04034b50, 0);
        localEntry.writeUInt16LE(20, 4);
        localEntry.writeUInt32LE(checksum, 14);
        localEntry.writeUInt32LE(content.length, 18);
        localEntry.writeUInt32LE(content.length, 22);
        localEntry.writeUInt16LE(name.length, 26);
        name.copy(localEntry, 30);
        content.copy(localEntry, 30 + name.length);
        localEntries.push(localEntry);

        const centralEntry = Buffer.alloc(46 + name.length);
        centralEntry.writeUInt32LE(0x02014b50, 0);
        centralEntry.writeUInt16LE((3 << 8) | 20, 4);
        centralEntry.writeUInt16LE(20, 6);
        centralEntry.writeUInt32LE(checksum, 16);
        centralEntry.writeUInt32LE(content.length, 20);
        centralEntry.writeUInt32LE(content.length, 24);
        centralEntry.writeUInt16LE(name.length, 28);
        centralEntry.writeUInt32LE(((entry.mode || 0o100644) << 16) >>> 0, 38);
        centralEntry.writeUInt32LE(localEntriesSize, 42);
        name.copy(centralEntry, 46);
        centralEntries.push(centralEntry);
        localEntriesSize += localEntry.length;
    }

    const centralDirectory = Buffer.concat(centralEntries);
    const endOfCentralDirectory = Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
    endOfCentralDirectory.writeUInt16LE(entries.length, 8);
    endOfCentralDirectory.writeUInt16LE(entries.length, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
    endOfCentralDirectory.writeUInt32LE(localEntriesSize, 16);

    return Buffer.concat([...localEntries, centralDirectory, endOfCentralDirectory]);
}

function crc32(content: Buffer): number {
    let checksum = 0xFFFFFFFF;
    for (const byte of content) {
        checksum ^= byte;
        for (let bit = 0; bit < 8; bit++) {
            checksum = (checksum >>> 1) ^ ((checksum & 1) ? 0xEDB88320 : 0);
        }
    }
    return (checksum ^ 0xFFFFFFFF) >>> 0;
}

describe('DownloadPackageV1 L0 Suite - PackageFile Unit Behavior', function () {
    const originalGetVariable = tl.getVariable;
    const originalGetPipelineFeature = tl.getPipelineFeature;
    let disableZipEntryValidation = false;

    beforeEach(() => {
        // Stub getVariable to return a known temp dir without touching the filesystem
        (tl as any).getVariable = (name: string) => {
            if (name === 'Agent.TempDirectory') return '/mock/agent/temp';
            return undefined;
        };
        disableZipEntryValidation = false;
        (tl as any).getPipelineFeature = (name: string) => {
            assert.strictEqual(name, 'DownloadPackage.DisableZipEntryValidation');
            return disableZipEntryValidation;
        };
    });

    afterEach(() => {
        (tl as any).getVariable = originalGetVariable;
        (tl as any).getPipelineFeature = originalGetPipelineFeature;
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

        function writePackageArchive(entries: ZipEntryForTest[]): string {
            const archivePath = path.join(testRoot, 'package.nupkg');
            fs.writeFileSync(archivePath, createZip(entries));
            (tl as any).getVariable = (name: string) => {
                if (name === 'Agent.TempDirectory') return testRoot;
                return undefined;
            };
            return archivePath;
        }

        it('extracts a regular NuGet package', async () => {
            const archivePath = path.join(testRoot, 'package.nupkg');
            fs.copyFileSync(path.join(__dirname, 'helpers', 'inputs', 'nugetFile.nupkg'), archivePath);
            (tl as any).getVariable = (name: string) => {
                if (name === 'Agent.TempDirectory') return testRoot;
                return undefined;
            };
            const pf = new PackageFile(true, destination, 'package.nupkg');

            await pf.process();

            assert.ok(fs.readdirSync(destination).length > 0);
        });

        it('rejects an outside symbolic link archive entry and removes it', async () => {
            writePackageArchive([
                { name: 'pivot', content: outside, mode: 0o120777 }
            ]);
            const pf = new PackageFile(true, destination, 'package.nupkg');

            await assert.rejects(() => pf.process(), {
                message: tl.loc('InvalidArchiveEntryLink', 'pivot')
            });
            assert.throws(() => fs.lstatSync(path.join(destination, 'pivot')), { code: 'ENOENT' });
        });

        it('rejects a duplicate file write through an outside link', async () => {
            const targetPath = path.join(outside, 'target.txt');
            fs.writeFileSync(targetPath, 'original contents');
            writePackageArchive([
                { name: 'pivot', content: '../outside/target.txt', mode: 0o120777 },
                { name: 'pivot', content: 'unexpected write' }
            ]);
            const pf = new PackageFile(true, destination, 'package.nupkg');

            await assert.rejects(() => pf.process(), {
                message: tl.loc('InvalidArchiveEntryLink', 'pivot')
            });
            assert.strictEqual(fs.readFileSync(targetPath, 'utf8'), 'original contents');
            assert.throws(() => fs.lstatSync(path.join(destination, 'pivot')), { code: 'ENOENT' });
        });

        it('rejects writes through a UNC link before writing outside on Windows', async function () {
            if (process.platform !== 'win32') {
                this.skip();
            }
            const drive = path.parse(outside).root;
            const uncOutside = `\\\\localhost\\${drive[0]}$\\${outside.slice(drive.length)}`;
            if (!fs.existsSync(uncOutside)) {
                this.skip();
            }
            writePackageArchive([
                { name: 'pivot', content: uncOutside, mode: 0o120777 },
                { name: 'pivot/target.txt', content: 'unexpected write' }
            ]);
            const pf = new PackageFile(true, destination, 'package.nupkg');

            await assert.rejects(() => pf.process());

            assert.strictEqual(fs.existsSync(path.join(outside, 'target.txt')), false);
            assert.throws(() => fs.lstatSync(path.join(destination, 'pivot')), { code: 'ENOENT' });
        });

        it('preserves an existing file when a symbolic link entry fails', async () => {
            const existingFile = path.join(destination, 'pivot');
            fs.writeFileSync(existingFile, 'existing contents');
            writePackageArchive([{ name: 'pivot', content: outside, mode: 0o120777 }]);
            const pf = new PackageFile(true, destination, 'package.nupkg');

            await assert.rejects(() => pf.process());

            assert.strictEqual(fs.readFileSync(existingFile, 'utf8'), 'existing contents');
        });

        it('allows internal file and directory links', async () => {
            writePackageArchive([
                { name: 'lib/target.txt', content: 'package contents' },
                { name: 'link', content: 'lib/target.txt', mode: 0o120777 },
                { name: 'directory-link', content: 'lib', mode: 0o120777 }
            ]);
            const pf = new PackageFile(true, destination, 'package.nupkg');

            await pf.process();

            for (const file of ['link', 'directory-link/target.txt']) {
                assert.strictEqual(fs.readFileSync(path.join(destination, file), 'utf8'), 'package contents');
            }
            assert.ok(fs.lstatSync(path.join(destination, 'link')).isSymbolicLink());
        });

        it('does not leave an outside link after extraction fails on a later entry', async () => {
            writePackageArchive([
                { name: 'pivot', content: '../outside', mode: 0o120777 },
                { name: 'pivot/target.txt', content: 'unexpected write' }
            ]);
            const pf = new PackageFile(true, destination, 'package.nupkg');

            await assert.rejects(() => pf.process());

            assert.strictEqual(fs.existsSync(path.join(outside, 'target.txt')), false);
            assert.throws(() => fs.lstatSync(path.join(destination, 'pivot')), { code: 'ENOENT' });
        });

        it('restores outside-link extraction when the rollback feature is enabled', async () => {
            disableZipEntryValidation = true;
            writePackageArchive([{ name: 'link', content: outside, mode: 0o120777 }]);
            const pf = new PackageFile(true, destination, 'package.nupkg');

            await pf.process();

            assert.strictEqual(fs.realpathSync(path.join(destination, 'link')), fs.realpathSync(outside));
        });

        it('rejects a linked direct-download destination root', () => {
            const linkedDestination = path.join(testRoot, 'linked-destination');
            createDirectoryLink(destination, linkedDestination);

            const pf = new PackageFile(false, linkedDestination, 'package.jar');

            assert.throws(() => pf.removeExisting());
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

            await assert.rejects(() => pf.process(), /InvalidPackageFileLink/);
        });

        it('rejects a linked extraction destination root', async () => {
            (tl as any).getVariable = (name: string) => {
                if (name === 'Agent.TempDirectory') return destination;
                return undefined;
            };
            const archivePath = path.join(destination, 'package.nupkg');
            fs.writeFileSync(archivePath, 'archive content');
            const linkedDestination = path.join(testRoot, 'linked-destination');
            createDirectoryLink(outside, linkedDestination);
            const pf = new PackageFile(true, linkedDestination, 'package.nupkg');

            await assert.rejects(() => pf.process(), {
                message: tl.loc('InvalidPackageDestinationLink', path.resolve(linkedDestination))
            });
        });

        it('allows a link above a direct-download destination', () => {
            const linkedParent = path.join(testRoot, 'linked-parent');
            createDirectoryLink(outside, linkedParent);
            fs.mkdirSync(path.join(outside, 'output'));
            const pf = new PackageFile(false, path.join(linkedParent, 'output'), 'package.jar');

            assert.doesNotThrow(() => pf.removeExisting());
        });

        it('allows a link above an extraction destination', async () => {
            (tl as any).getVariable = (name: string) => {
                if (name === 'Agent.TempDirectory') return destination;
                return undefined;
            };
            // An empty zip is just the end-of-central-directory record.
            const emptyZip = Buffer.concat([Buffer.from([0x50, 0x4b, 0x05, 0x06]), Buffer.alloc(18)]);
            fs.writeFileSync(path.join(destination, 'package.nupkg'), emptyZip);
            fs.mkdirSync(path.join(outside, 'output'));
            const linkedParent = path.join(testRoot, 'linked-parent');
            createDirectoryLink(outside, linkedParent);
            const pf = new PackageFile(true, path.join(linkedParent, 'output'), 'package.nupkg');

            await pf.process();
        });
    });
});
