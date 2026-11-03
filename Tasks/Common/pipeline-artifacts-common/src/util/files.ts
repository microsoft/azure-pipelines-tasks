import * as fs from 'fs';
import { withRetry } from './concurrency';

const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);

/** On Windows an antivirus scanner or an indexer can hold a freshly written file for a moment, which fails the rename. */
export async function renameWithRetry(
    from: string,
    to: string,
    options: { rename?: (from: string, to: string) => Promise<void>; platform?: NodeJS.Platform; retries?: number; baseDelayMs?: number } = {}
): Promise<void> {
    const rename = options.rename ?? fs.promises.rename;
    if ((options.platform ?? process.platform) !== 'win32') {
        await rename(from, to);
        return;
    }
    await withRetry(() => rename(from, to), {
        retries: options.retries ?? 10,
        baseDelayMs: options.baseDelayMs ?? 50,
        maxDelayMs: 1000,
        shouldRetry: error => TRANSIENT_RENAME_CODES.has((error as NodeJS.ErrnoException | undefined)?.code ?? '')
    });
}
