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

function blockingSleep(milliseconds: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

/**
 * Moves a file or a symbolic link. A rename cannot cross file systems (EXDEV), and the temporary folder of the agent and the destination are on
 * different ones when the destination exists only inside a job container, for example. Then the entry is copied and the original removed.
 */
export async function moveFile(from: string, to: string, options: Parameters<typeof renameWithRetry>[2] = {}): Promise<void> {
    try {
        await renameWithRetry(from, to, options);
        return;
    } catch (error) {
        if ((error as NodeJS.ErrnoException | undefined)?.code !== 'EXDEV') {
            throw error;
        }
    }
    const stat = await fs.promises.lstat(from);
    // A rename replaces the entry that is at the destination; it does not write through a link that is there.
    await fs.promises.rm(to, { force: true });
    if (stat.isSymbolicLink()) {
        await fs.promises.symlink(await fs.promises.readlink(from), to);
    } else {
        await fs.promises.copyFile(from, to);
        await fs.promises.chmod(to, stat.mode & 0o7777);
    }
    await fs.promises.unlink(from);
}

/** The same as renameWithRetry for a thread that may block, such as a worker thread: the waits between the attempts block the thread. */
export function renameSyncWithRetry(
    from: string,
    to: string,
    options: { rename?: (from: string, to: string) => void; platform?: NodeJS.Platform; retries?: number; baseDelayMs?: number; sleep?: (milliseconds: number) => void } = {}
): void {
    const rename = options.rename ?? fs.renameSync;
    if ((options.platform ?? process.platform) !== 'win32') {
        rename(from, to);
        return;
    }
    const retries = options.retries ?? 10;
    const baseDelay = options.baseDelayMs ?? 50;
    const sleep = options.sleep ?? blockingSleep;
    for (let attempt = 0; ; attempt++) {
        try {
            rename(from, to);
            return;
        } catch (error) {
            if (attempt >= retries || !TRANSIENT_RENAME_CODES.has((error as NodeJS.ErrnoException | undefined)?.code ?? '')) {
                throw error;
            }
            const backoff = Math.min(1000, baseDelay * 2 ** attempt);
            sleep(Math.round(backoff / 2 + Math.random() * backoff / 2));
        }
    }
}
