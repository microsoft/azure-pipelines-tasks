import * as assert from 'assert';
import * as fs from 'fs';
import { chunkBuffer, DEDUP_1024K, DEDUP_64K } from '../src/dedup/chunker';
import { BlobRef, EMPTY_CHUNK_ID, chunkIdOf, isChunkId, isNodeId, normalizeDedupId } from '../src/dedup/hashing';
import { buildManifest, parseManifest } from '../src/dedup/manifest';
import { NodeBuilder, parseNode, serializeNode } from '../src/dedup/nodes';
import { decompressChunk } from '../src/dedup/lz77';
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
        assert.throws(() => serializeNode([]));
        assert.throws(() => serializeNode(fakeChunks(513)));
        assert.throws(() => serializeNode([{ id: 'A'.repeat(64) + '01', size: 1 << 24 }]));
    });

    it('normalizes and validates identifiers', () => {
        assert.strictEqual(normalizeDedupId('a'.repeat(64) + '01'), 'A'.repeat(64) + '01');
        assert.throws(() => normalizeDedupId('xyz'));
        assert.throws(() => normalizeDedupId('A'.repeat(64) + '03'));
    });
});

describe('dedup node trees', () => {
    it('returns a single child unchanged unless a node is forced', () => {
        const builder = new NodeBuilder();
        const [only] = fakeChunks(1);
        assert.strictEqual(builder.tree([only]), only);
        const forced = builder.tree([only], { forceNode: true });
        assert.ok(isNodeId(forced.id) && forced.size === only.size);
    });

    it('packs complete groups of 512 and carries the remainder (BuildXL maximally packed)', () => {
        const chunks = fakeChunks(1364);
        const builder = new NodeBuilder();
        const root = builder.tree(chunks);
        const rootChildren = builder.nodes.get(root.id)!.children;
        assert.strictEqual(rootChildren.length, 342);
        assert.strictEqual(rootChildren.filter(child => isNodeId(child.id)).length, 2);
        assert.ok(isNodeId(rootChildren[0].id) && isNodeId(rootChildren[1].id) && isChunkId(rootChildren[2].id));
        assert.strictEqual(root.size, chunks.reduce((sum, chunk) => sum + chunk.size, 0));
        assert.strictEqual(builder.nodes.size, 3);
    });

    it('handles exactly 512 and 513 children', () => {
        assert.strictEqual(new NodeBuilder().tree(fakeChunks(512)).size, fakeChunks(512).reduce((s, c) => s + c.size, 0));
        const builder = new NodeBuilder();
        const root = builder.tree(fakeChunks(513));
        assert.strictEqual(builder.nodes.get(root.id)!.children.length, 2);
    });

    it('builds deeper trees for very large chunk lists and records proofs in creation order', () => {
        const builder = new NodeBuilder();
        const proofs: Buffer[] = [];
        const root = builder.tree(fakeChunks(512 * 512 + 600), { proofs });
        const rootChildren = builder.nodes.get(root.id)!.children;
        assert.ok(rootChildren.length <= 512);
        assert.strictEqual(proofs.length, builder.nodes.size);
        assert.deepStrictEqual(proofs[proofs.length - 1], builder.nodes.get(root.id)!.data);
    });
});

describe('manifest and super root', () => {
    it('reproduces the ArtifactTool reference manifest, manifest id and super root', () => {
        const expectedManifest = fs.readFileSync(fixturePath('reference-manifest.json'));
        const verification = readFixtureJson('reference-verification.json');
        const helloChunk: BlobRef = { id: 'AC9A362E6F4DC699A83550A27A3F7EBDCAA7C01B00C79FA53F84BD45AAA2004A01', size: 44 };

        const manifest = buildManifest([{ path: '/hello.txt', blob: helloChunk }]);
        assert.strictEqual(manifest.toString('utf8'), expectedManifest.toString('utf8'));

        const builder = new NodeBuilder();
        const proofs: Buffer[] = [];
        const contentRoot = builder.tree([helloChunk], { forceNode: true, proofs });
        const manifestChunks = chunkBuffer(manifest, DEDUP_64K);
        const manifestRoot = builder.tree(manifestChunks);
        const superRoot = builder.node([contentRoot, manifestRoot], proofs);

        assert.strictEqual(manifestRoot.id, verification.metadata.manifest_id);
        assert.strictEqual(superRoot.id, verification.metadata.super_root_id);
        assert.strictEqual(superRoot.size, verification.metadata.package_size);
        assert.strictEqual(proofs.length, 2);
    });

    it('reproduces the multi file reference super root structure', () => {
        const expected = fs.readFileSync(fixturePath('next-reference-super-root.bin'));
        const verification = readFixtureJson('next-reference-verification.json');
        const manifestBytes = fs.readFileSync(fixturePath('next-reference-manifest.json'));
        const items = parseManifest(manifestBytes);
        assert.deepStrictEqual(buildManifest(items), manifestBytes);

        const builder = new NodeBuilder();
        const contentRoot = builder.tree(items.map(item => item.blob!), { forceNode: true });
        const manifestRoot = builder.tree(chunkBuffer(manifestBytes, DEDUP_64K));
        const superRoot = builder.node([contentRoot, manifestRoot]);
        assert.strictEqual(manifestRoot.id, verification.metadata.manifest_id);
        assert.strictEqual(superRoot.id, verification.metadata.super_root_id);
        assert.deepStrictEqual(builder.nodes.get(superRoot.id)!.data, expected);
    });

    it('sorts nothing and escapes nothing unexpectedly', () => {
        const blob: BlobRef = { id: EMPTY_CHUNK_ID, size: 0 };
        const text = buildManifest([{ path: '/dir with space/ü"quote\\.txt', blob }]).toString('utf8');
        assert.deepStrictEqual(JSON.parse(text).items[0].path, '/dir with space/ü"quote\\.txt');
        assert.ok(text.startsWith('{"manifestFormat":"1.1.0","items":[{"path":'));
        assert.ok(text.endsWith('"manifestReferences":[]}'));
    });

    it('reads and writes the empty directory items of the BlobStore client', () => {
        // The manifest the in-box PublishPipelineArtifact@1 task stored for a directory with an empty directory in it.
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
        assert.strictEqual(builderRootOf(bytes), 'CE8C9C26FDD1ECCC6D074A68E015FC2487FA58453277EE40C0D479C46A2895CB01');
    });

    function builderRootOf(manifest: Buffer): string {
        return new NodeBuilder().tree(chunkBuffer(manifest, DEDUP_1024K)).id;
    }

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
