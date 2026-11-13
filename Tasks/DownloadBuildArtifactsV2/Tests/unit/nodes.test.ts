import * as assert from 'assert';
import * as fs from 'fs';
import { BlobRef, EMPTY_CHUNK_ID, chunkIdOf, isChunkId, isNodeId, nodeIdOf, normalizeDedupId } from '../../DownloadEngine/dedup/hashing';
import { parseManifest } from '../../DownloadEngine/dedup/manifest';
import { parseNode } from '../../DownloadEngine/dedup/nodes';
import { NodeBuilder, buildManifest, serializeNode } from './artifactWriter';
import { fixturePath, readFixtureJson } from './testUtil';

function fakeChunks(count: number): BlobRef[] {
    return Array.from({ length: count }, (_, i) => ({ id: chunkIdOf(Buffer.from(`chunk-${i}`)), size: 100 + i }));
}

describe('dedup node format', () => {
    it('round trips chunk and node children', () => {
        const builder = new NodeBuilder();
        const inner = builder.node(fakeChunks(3));
        const children: BlobRef[] = [...fakeChunks(2), inner];
        const parsed = parseNode(serializeNode(children));
        assert.deepStrictEqual(parsed, children);
        assert.ok(isNodeId(inner.id) && isChunkId(children[0].id));
    });

    it('supports node sizes beyond 32 bits', () => {
        const big: BlobRef = { id: 'A'.repeat(64) + '02', size: 5 * 2 ** 32 + 7 };
        assert.deepStrictEqual(parseNode(serializeNode([big])), [big]);
    });

    it('rejects malformed nodes', () => {
        assert.throws(() => parseNode(Buffer.alloc(3)));
        assert.throws(() => parseNode(Buffer.from([1, 0, 0, 0])));
        assert.throws(() => parseNode(Buffer.concat([serializeNode(fakeChunks(1)), Buffer.from([0])])));
    });

    it('normalizes and validates identifiers', () => {
        assert.strictEqual(normalizeDedupId('a'.repeat(64) + '01'), 'A'.repeat(64) + '01');
        assert.throws(() => normalizeDedupId('xyz'));
        assert.throws(() => normalizeDedupId('A'.repeat(64) + '03'));
    });
});

describe('manifest and super root', () => {
    it('reads the ArtifactTool reference manifest and finds its manifest id and super root', () => {
        const manifestBytes = fs.readFileSync(fixturePath('reference-manifest.json'));
        const verification = readFixtureJson('reference-verification.json');
        const helloChunk: BlobRef = { id: 'AC9A362E6F4DC699A83550A27A3F7EBDCAA7C01B00C79FA53F84BD45AAA2004A01', size: 44 };

        assert.deepStrictEqual(parseManifest(manifestBytes), [{ path: '/hello.txt', blob: helloChunk }]);
        assert.deepStrictEqual(buildManifest(parseManifest(manifestBytes)), manifestBytes);

        // The manifest is a single chunk, so its identifier is the root of the manifest.
        const manifestRoot: BlobRef = { id: chunkIdOf(manifestBytes), size: manifestBytes.length };
        assert.strictEqual(manifestRoot.id, verification.metadata.manifest_id);

        const builder = new NodeBuilder();
        const contentRoot = builder.node([helloChunk]);
        const superRoot = builder.node([contentRoot, manifestRoot]);
        assert.strictEqual(superRoot.id, verification.metadata.super_root_id);
        assert.strictEqual(superRoot.size, verification.metadata.package_size);
        assert.deepStrictEqual(parseNode(builder.nodes.get(superRoot.id)!.data), [contentRoot, manifestRoot]);
    });

    it('reads the multi file reference super root', () => {
        const expected = fs.readFileSync(fixturePath('next-reference-super-root.bin'));
        const verification = readFixtureJson('next-reference-verification.json');
        const manifestBytes = fs.readFileSync(fixturePath('next-reference-manifest.json'));
        const items = parseManifest(manifestBytes);
        assert.deepStrictEqual(buildManifest(items), manifestBytes);

        const manifestRoot: BlobRef = { id: chunkIdOf(manifestBytes), size: manifestBytes.length };
        assert.strictEqual(manifestRoot.id, verification.metadata.manifest_id);
        assert.strictEqual(nodeIdOf(expected), verification.metadata.super_root_id);

        const [contentRoot, manifest] = parseNode(expected);
        assert.deepStrictEqual(manifest, manifestRoot);
        assert.ok(isNodeId(contentRoot.id));
        assert.strictEqual(contentRoot.size, items.reduce((sum, item) => sum + item.blob!.size, 0));
        assert.deepStrictEqual(serializeNode([new NodeBuilder().node(items.map(item => item.blob!)), manifestRoot]), expected);
    });

    it('reads the empty directory items of the BlobStore client', () => {
        // A manifest as the service stored it for a folder that has an empty folder in it.
        const text = '{"manifestFormat":"1.1.0","items":['
            + '{"path":"/.gitignore","blob":{"id":"43775C730DB49EF629CF34D5775FC65E3DDB670153117A1D56AE05CECDDD315C01","size":8}},'
            + '{"path":"/emptydir","type":"EmptyDirectory"},'
            + '{"path":"/keep.txt","blob":{"id":"A4ABD4448C49562D828115D13A1FCCEA927F52B4D5459297F8B43E42DA89238B01","size":1}},'
            + '{"path":"/sub/.gitignore","blob":{"id":"121B4774A759924A2929C4A412FB6E31B9AAA746466840EFCC4A76D69A94149E01","size":1}},'
            + '{"path":"/sub/file.txt","blob":{"id":"5AE625665F3E0BD0A065ED07A41989E4025B79D13930A2A8C57D6B432522670701","size":1}}'
            + '],"manifestReferences":[]}';
        const bytes = Buffer.from(text, 'utf8');

        const items = parseManifest(bytes);
        assert.deepStrictEqual(items.map(item => [item.path, item.type, item.blob?.size]), [
            ['/.gitignore', undefined, 8], ['/emptydir', 'EmptyDirectory', undefined], ['/keep.txt', undefined, 1],
            ['/sub/.gitignore', undefined, 1], ['/sub/file.txt', undefined, 1]
        ]);
        assert.deepStrictEqual(buildManifest(items), bytes);
        assert.strictEqual(chunkIdOf(bytes), 'CE8C9C26FDD1ECCC6D074A68E015FC2487FA58453277EE40C0D479C46A2895CB01');
    });

    it('rejects items of an unknown type', () => {
        assert.throws(() => parseManifest(Buffer.from('{"items":[{"path":"/a","type":"Symlink"}],"manifestReferences":[]}')), /unsupported type/);
        assert.throws(() => parseManifest(Buffer.from('{"items":[{"path":"/a","type":7}],"manifestReferences":[]}')));
        assert.throws(() => parseManifest(Buffer.from('{"items":[{"path":"/a","type":"File"}],"manifestReferences":[]}')), /invalid item/);
        assert.strictEqual(parseManifest(Buffer.from('{"items":[{"path":"/a","type":"emptydirectory"}],"manifestReferences":[]}'))[0].type, 'EmptyDirectory');
    });

    it('rejects malformed manifests', () => {
        assert.throws(() => parseManifest(Buffer.from('not json')));
        assert.throws(() => parseManifest(Buffer.from('{"items":[{"path":"/a","blob":{"id":"zz","size":1}}]}')));
        assert.throws(() => parseManifest(Buffer.from('{"items":[],"manifestReferences":[{}]}')));
        assert.throws(() => parseManifest(Buffer.from('{"items":[{"path":"/a","blob":{"id":"' + EMPTY_CHUNK_ID + '","size":-1}}]}')));
    });
});
