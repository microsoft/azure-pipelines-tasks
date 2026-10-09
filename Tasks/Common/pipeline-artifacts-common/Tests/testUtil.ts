import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export function fixturePath(name: string): string {
    const candidates = [
        path.join(__dirname, 'fixtures', name),
        path.join(__dirname, '..', '..', 'Tests', 'fixtures', name)
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) {
            return candidate;
        }
    }
    throw new Error(`Fixture not found: ${name}`);
}

export function readFixtureJson<T = any>(name: string): T {
    return JSON.parse(fs.readFileSync(fixturePath(name), 'utf8')) as T;
}

/** Deterministic pseudo random bytes: SHA256(seed NUL uint64_le(i)) blocks, as used by the reference vectors. */
export function seeded(seed: string, size: number): Buffer {
    const prefix = Buffer.concat([Buffer.from(seed, 'utf8'), Buffer.from([0])]);
    const count = Math.ceil(size / 32);
    const out = Buffer.allocUnsafe(count * 32);
    const index = Buffer.alloc(8);
    for (let i = 0; i < count; i++) {
        index.writeBigUInt64LE(BigInt(i));
        crypto.createHash('sha256').update(prefix).update(index).digest().copy(out, i * 32);
    }
    return out.subarray(0, size);
}

export function shortReadSource(data: Buffer, maxRead: number) {
    return {
        async read(buffer: Buffer, offset: number, length: number, position?: number | null): Promise<{ bytesRead: number }> {
            const from = position ?? 0;
            const count = Math.max(0, Math.min(length, maxRead, data.length - from));
            data.copy(buffer, offset, from, from + count);
            return { bytesRead: count };
        }
    };
}
