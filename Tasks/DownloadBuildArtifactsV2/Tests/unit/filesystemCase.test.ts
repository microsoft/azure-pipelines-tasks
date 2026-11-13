import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CaseProbeFileSystem, isFilesystemCaseInsensitive } from '../../DownloadEngine/util/filesystemCase';

/**
 * A file system in memory: the folders with their entries, whether names are case-insensitive, and the device of each folder.
 * `dangling` lists symbolic links whose target is missing: they are entries, but `existsSync` (which follows them) says they are not there.
 */
function fakeFileSystem(folders: Record<string, string[]>, insensitive: boolean, devices: Record<string, number> = {}, dangling: string[] = []): CaseProbeFileSystem {
    const resolved = new Map<string, string[]>();
    for (const [folder, entries] of Object.entries(folders)) {
        resolved.set(path.resolve(folder), entries);
    }
    const same = (a: string, b: string) => insensitive ? a.toLowerCase() === b.toLowerCase() : a === b;
    const isEntry = (target: fs.PathLike): boolean => {
        const full = path.resolve(String(target));
        if ([...resolved.keys()].some(folder => same(folder, full))) {
            return true;
        }
        const entries = resolved.get(path.dirname(full));
        return entries !== undefined && entries.some(entry => same(entry, path.basename(full)));
    };
    const existsSync = (target: fs.PathLike): boolean => isEntry(target) && !dangling.some(link => same(path.resolve(link), path.resolve(String(target))));
    return {
        existsSync,
        lstatSync: ((target: string) => {
            if (!isEntry(target)) {
                throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            }
            return {};
        }) as unknown as CaseProbeFileSystem['lstatSync'],
        readdirSync: ((folder: string) => {
            const entries = resolved.get(path.resolve(folder));
            if (!entries) {
                throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
            }
            return [...entries];
        }) as unknown as CaseProbeFileSystem['readdirSync'],
        statSync: ((target: string) => ({ dev: devices[path.resolve(target)] ?? 1 })) as unknown as CaseProbeFileSystem['statSync']
    };
}

const at = (...parts: string[]) => path.resolve(path.sep, ...parts);

describe('filesystem case detection', () => {
    it('finds out from an entry of the folder whether names ignore case', () => {
        const folders = { [at('work')]: ['Artifacts', 'src'] };
        assert.strictEqual(isFilesystemCaseInsensitive(at('work'), fakeFileSystem(folders, true)), true);
        assert.strictEqual(isFilesystemCaseInsensitive(at('work'), fakeFileSystem(folders, false)), false);
    });

    it('asks the nearest folder that exists when the destination is not there yet', () => {
        const folders = { [at('work')]: ['a'] };
        assert.strictEqual(isFilesystemCaseInsensitive(at('work', 'new', 'deeper'), fakeFileSystem(folders, true)), true);
        assert.strictEqual(isFilesystemCaseInsensitive(at('work', 'new', 'deeper'), fakeFileSystem(folders, false)), false);
    });

    it('goes up from an empty folder, or one without letters in its names, as long as the device stays the same', () => {
        const folders = { [at('work')]: ['1', 'Src'], [at('work', 'drop')]: [], [at('work', 'digits')]: ['123', '.456'] };
        assert.strictEqual(isFilesystemCaseInsensitive(at('work', 'drop'), fakeFileSystem(folders, true)), true);
        assert.strictEqual(isFilesystemCaseInsensitive(at('work', 'digits'), fakeFileSystem(folders, true)), true);
        assert.strictEqual(isFilesystemCaseInsensitive(at('work', 'drop'), fakeFileSystem(folders, false)), false);
        const otherDevice = fakeFileSystem(folders, true, { [at('work', 'drop')]: 2, [at('work')]: 1 });
        assert.strictEqual(isFilesystemCaseInsensitive(at('work', 'drop'), otherDevice), false);
    });

    it('takes two entries that differ only in case as proof of a case-sensitive file system', () => {
        const folders = { [at('work')]: ['Data', 'data'] };
        assert.strictEqual(isFilesystemCaseInsensitive(at('work'), fakeFileSystem(folders, true)), false);
    });

    it('counts a symbolic link whose target is missing as an entry', () => {
        const folders = { [at('work')]: ['Broken', 'src'] };
        const links = [at('work', 'Broken')];
        assert.strictEqual(isFilesystemCaseInsensitive(at('work'), fakeFileSystem(folders, true, {}, links)), true);
        assert.strictEqual(isFilesystemCaseInsensitive(at('work'), fakeFileSystem(folders, false, {}, links)), false);
    });

    it('answers false, which keeps the matching case-sensitive, when it cannot tell', () => {
        assert.strictEqual(isFilesystemCaseInsensitive('', fakeFileSystem({}, true)), false);
        assert.strictEqual(isFilesystemCaseInsensitive(at('nothing'), fakeFileSystem({}, true)), false);
        const broken = { existsSync: () => { throw new Error('denied'); }, lstatSync: () => { throw new Error('denied'); }, readdirSync: () => [], statSync: () => ({ dev: 1 }) } as unknown as CaseProbeFileSystem;
        assert.strictEqual(isFilesystemCaseInsensitive(at('work'), broken), false);
    });

    it('agrees with the file system of this machine', function () {
        const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'dba-case-'));
        try {
            fs.writeFileSync(path.join(folder, 'CaseProbe.txt'), '');
            const answer = isFilesystemCaseInsensitive(path.join(folder, 'not', 'there', 'yet'));
            if (process.platform === 'win32') {
                assert.strictEqual(answer, true);
            } else if (process.platform === 'linux' && !folder.startsWith('/mnt/')) {
                assert.strictEqual(answer, false);
            } else {
                assert.strictEqual(typeof answer, 'boolean');
            }
            // The check never leaves anything behind.
            assert.deepStrictEqual(fs.readdirSync(folder), ['CaseProbe.txt']);
        } finally {
            fs.rmSync(folder, { recursive: true, force: true });
        }
    });
});
